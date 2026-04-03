import { useState, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isAgentRole, type UserRole } from '@/types/auth'
import LoginIllustration from '@/components/illustrations/LoginIllustration'

// ── OAuth icons ──────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.018 1.793-4.684 4.533-4.684 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.93-1.956 1.886v2.273h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────

type Step = 'email' | 'login' | 'register' | 'forgot' | 'forgot-sent'

// ── Background image ────────────────────────────────────────────────────

// ── Main component ──────────────────────────────────────────────────────

export default function LoginPage() {
  const { user, profile, loading: authLoading, signInWithPassword, signInWithGoogle, signUp, resetPassword } = useAuth()
  const [searchParams] = useSearchParams()

  // State
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fbToast, setFbToast] = useState(false)

  const isAgentMode = searchParams.get('role') === 'agent'

  // Store redirect URL before auth
  useEffect(() => {
    const redirect = searchParams.get('redirect')
    if (redirect) sessionStorage.setItem('megga_redirect', redirect)
  }, [searchParams])

  // Redirect if already logged in
  if (!authLoading && user && profile) {
    const redirect = sessionStorage.getItem('megga_redirect')
    if (redirect) {
      sessionStorage.removeItem('megga_redirect')
      return <Navigate to={redirect} replace />
    }
    if (isAgentRole(profile.role)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/acheter" replace />
  }
  if (!authLoading && user && !profile) {
    const metaRole = user.user_metadata?.role as string | undefined
    if (metaRole && isAgentRole(metaRole as UserRole)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/acheter" replace />
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    // Try to sign in with empty password to detect if user exists
    const { error: err } = await signInWithPassword(email.trim(), '__check_existence__')
    setLoading(false)

    if (err) {
      // "Invalid login credentials" → user exists (wrong password)
      if (err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials')) {
        setStep('login')
        return
      }
      // Any other error (user not found, etc.) → show register
      setStep('register')
      return
    }
    // Unlikely: empty password worked — user is logged in (shouldn't happen)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

    const { error: err } = await signInWithPassword(email.trim(), password)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    // Redirect handled by Navigate above on re-render
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || !firstName.trim()) return
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    setLoading(true)
    setError(null)

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const role: UserRole = isAgentMode ? 'agent' : 'particulier'
    const { error: err } = await signUp(email.trim(), password, fullName, role)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    // After sign-up, Supabase may auto-login or require email confirmation
    // The Navigate check above will handle redirect
  }

  async function handleGoogle() {
    setOauthLoading('google')
    setError(null)
    // Store redirect for after OAuth
    const redirect = searchParams.get('redirect') || (isAgentMode ? '/dashboard' : '/acheter')
    sessionStorage.setItem('megga_redirect', redirect)
    if (isAgentMode) localStorage.setItem('megga_oauth_role', 'agent')

    const { error: err } = await signInWithGoogle(isAgentMode ? 'agent' : undefined)
    if (err) {
      setError(err)
      setOauthLoading(null)
    }
  }

  function handleFacebook() {
    // Facebook OAuth not yet configured — show toast
    setFbToast(true)
    setTimeout(() => setFbToast(false), 3000)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await resetPassword(email.trim())
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setStep('forgot-sent')
    }
  }

  function goBack() {
    setStep('email')
    setPassword('')
    setError(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white relative">
        {/* Facebook toast */}
        {fbToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            Facebook sera disponible prochainement
          </div>
        )}

        <div className="w-full max-w-sm">
          {/* Logo */}
          <Link to="/" className="block mb-10">
            <img src="/megga-logo.svg" alt="MEGGA" className="h-7 mx-auto" />
          </Link>

          {/* ── STEP: Email (identifier) ── */}
          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-xl font-semibold text-gray-900">
                  {isAgentMode ? 'Espace professionnel' : 'Bienvenue sur MEGGA'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Connectez-vous ou créez votre compte
                </p>
              </div>

              {/* OAuth buttons */}
              <div className="space-y-2.5 mb-6">
                <button
                  onClick={handleGoogle}
                  disabled={!!oauthLoading}
                  className="w-full h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  Continuer avec Google
                </button>

                <button
                  onClick={handleFacebook}
                  disabled={!!oauthLoading}
                  className="w-full h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <FacebookIcon className="h-5 w-5" />
                  Continuer avec Facebook
                </button>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Email input */}
              <form onSubmit={handleEmailContinue}>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.ch"
                  required
                  autoFocus
                  className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 mt-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuer'}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}

              {/* Pro link */}
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                {isAgentMode ? (
                  <Link to="/login" className="text-sm text-gray-500 hover:text-accent transition-colors">
                    Retour au compte particulier
                  </Link>
                ) : (
                  <Link to="/login?role=agent" className="text-sm text-gray-500 hover:text-accent transition-colors">
                    Vous êtes un professionnel ? <span className="font-medium">Espace agent</span> &rarr;
                  </Link>
                )}
              </div>
            </>
          )}

          {/* ── STEP: Login (email exists) ── */}
          {step === 'login' && (
            <>
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">Bon retour !</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleLogin}>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    required
                    autoFocus
                    className="w-full h-11 px-3.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setError(null) }}
                  className="text-xs text-gray-500 hover:text-accent mt-2 transition-colors"
                >
                  Mot de passe oublié ?
                </button>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-11 mt-5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Se connecter'}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}
            </>
          )}

          {/* ── STEP: Register (new email) ── */}
          {step === 'register' && (
            <>
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">Créer votre compte</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Prénom
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoFocus
                    className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nom
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="regPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe <span className="text-gray-400 font-normal">(min 8 caractères)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="regPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full h-11 px-3.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !firstName.trim() || password.length < 8}
                  className="w-full h-11 mt-1 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer mon compte'}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}

              <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
                En créant un compte, vous acceptez nos{' '}
                <Link to="/privacy" className="underline hover:text-gray-600">conditions d'utilisation</Link>
                {' '}et notre{' '}
                <Link to="/privacy" className="underline hover:text-gray-600">politique de confidentialité</Link>.
              </p>
            </>
          )}

          {/* ── STEP: Forgot password ── */}
          {step === 'forgot' && (
            <>
              <button onClick={() => { setStep('login'); setError(null) }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">Mot de passe oublié</h1>
              <p className="text-sm text-gray-500 mb-6">
                Nous enverrons un lien de réinitialisation à <strong>{email}</strong>
              </p>

              <form onSubmit={handleForgotPassword}>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer le lien'}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}
            </>
          )}

          {/* ── STEP: Forgot password sent ── */}
          {step === 'forgot-sent' && (
            <>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">Email envoyé</h1>
                <p className="text-sm text-gray-500">
                  Vérifiez votre boîte de réception à <strong>{email}</strong>.
                  Cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>
                <button
                  onClick={() => { setStep('login'); setError(null) }}
                  className="mt-6 text-sm text-gray-500 hover:text-accent transition-colors"
                >
                  Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Illustration (desktop only) */}
      <div className="hidden lg:block w-[45%] relative overflow-hidden">
        <LoginIllustration className="w-full h-full" />
        <div className="absolute bottom-8 left-8 right-8">
          <p className="text-white/90 text-lg font-medium">
            La plateforme immobilière suisse
          </p>
          <p className="text-white/60 text-sm mt-1">
            38'000+ biens analysés dans 26 cantons
          </p>
        </div>
      </div>
    </div>
  )
}
