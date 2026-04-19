import { useState, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import GoogleOneTap from '@/components/auth/GoogleOneTap'
import { cn } from '@/lib/utils'
import { ArrowLeft, Loader2, Eye, EyeOff, Sparkles, X, Mail, ChevronDown, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { REMEMBER_KEY } from '@/lib/supabase'
import { isAgentRole, type UserRole } from '@/types/auth'

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

// Official Microsoft logo — 4 squares (red, green, blue, yellow)
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M11.4 11.4H1V1h10.4v10.4Z" fill="#F25022" />
      <path d="M23 11.4H12.6V1H23v10.4Z" fill="#7FBA00" />
      <path d="M11.4 23H1V12.6h10.4V23Z" fill="#00A4EF" />
      <path d="M23 23H12.6V12.6H23V23Z" fill="#FFB900" />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────

type Step = 'email' | 'login' | 'register' | 'forgot' | 'forgot-sent' | 'magic-link-sent'

// Shared motion props for each step. Apple-ish easing, subtle slide+fade.
const stepMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
}

// ── Background image ────────────────────────────────────────────────────

// ── Main component ──────────────────────────────────────────────────────

export default function LoginPage() {
  const { t } = useTranslation('common')
  const { user, profile, loading: authLoading, signInWithPassword, signInWithEmail, signInWithGoogle, signInWithMicrosoft, signInWithFacebook, signUp, resetPassword } = useAuth()
  const [searchParams] = useSearchParams()

  // State
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(REMEMBER_KEY) !== 'false'
  })
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | 'microsoft' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAgentMode = searchParams.get('role') === 'agent'

  // Store redirect URL before auth
  useEffect(() => {
    const redirect = searchParams.get('redirect')
    if (redirect) sessionStorage.setItem('megga_redirect', redirect)
  }, [searchParams])

  // Persist the "Remember me" preference BEFORE any sign-in happens so the
  // storage adapter picks the right backend (localStorage vs sessionStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  }, [remember])

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

  async function handleFacebook() {
    setOauthLoading('facebook')
    setError(null)
    const redirect = searchParams.get('redirect') || (isAgentMode ? '/dashboard' : '/acheter')
    sessionStorage.setItem('megga_redirect', redirect)
    if (isAgentMode) localStorage.setItem('megga_oauth_role', 'agent')

    const { error: err } = await signInWithFacebook(isAgentMode ? 'agent' : undefined)
    if (err) {
      setError(err)
      setOauthLoading(null)
    }
  }

  async function handleMicrosoft() {
    setOauthLoading('microsoft')
    setError(null)
    const redirect = searchParams.get('redirect') || (isAgentMode ? '/dashboard' : '/acheter')
    sessionStorage.setItem('megga_redirect', redirect)
    if (isAgentMode) localStorage.setItem('megga_oauth_role', 'agent')

    const { error: err } = await signInWithMicrosoft(isAgentMode ? 'agent' : undefined)
    if (err) {
      setError(err)
      setOauthLoading(null)
    }
  }

  async function handleMagicLink() {
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithEmail(email.trim())
    setLoading(false)
    if (err) { setError(err); return }
    setStep('magic-link-sent')
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
    <main id="main-content" className="min-h-screen bg-gray-100 lg:p-4 flex">
      {/* Google One Tap — buyers only, not agents, not when already signed in */}
      <GoogleOneTap disabled={isAgentMode || !!user} />
      <div className="flex-1 bg-white lg:rounded-3xl lg:shadow-[0_20px_50px_-20px_rgba(15,23,42,0.15)] overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col px-6 py-10 lg:px-12 lg:py-10 bg-white relative">
          {/* Logo top-left */}
          <Link to="/" className="inline-block self-start mb-auto">
            <img src="/megga-logo.svg" alt="MEGGA" className="h-7" />
          </Link>

          <div className="w-full max-w-sm mx-auto -mt-8 lg:mt-0">
          <AnimatePresence mode="wait" initial={false}>

          {/* ── STEP: Email (identifier) ── */}
          {step === 'email' && (
            <motion.div key="email" {...stepMotion}>
              <div className="text-center mb-8">
                <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
                  {isAgentMode ? t('auth.professionalSpace') : t('auth.welcomeToMegga')}
                </h1>
                <p className="text-[13px] text-gray-500 mt-1.5">
                  {t('auth.loginOrCreate')}
                </p>
              </div>

              {/* OAuth buttons — rounded-full pills matching /louer design language */}
              <div className="space-y-2 mb-6">
                <button
                  onClick={handleGoogle}
                  disabled={!!oauthLoading}
                  className="group w-full h-11 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-900 hover:border-gray-900 hover:shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-4 w-4" />
                  )}
                  {t('auth.continueWithGoogle')}
                </button>

                <button
                  onClick={handleMicrosoft}
                  disabled={!!oauthLoading}
                  className="group w-full h-11 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-900 hover:border-gray-900 hover:shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading === 'microsoft' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MicrosoftIcon className="h-4 w-4" />
                  )}
                  Continuer avec Microsoft
                </button>

                <button
                  onClick={handleFacebook}
                  disabled={!!oauthLoading}
                  className="group w-full h-11 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-900 hover:border-gray-900 hover:shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading === 'facebook' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FacebookIcon className="h-4 w-4" />
                  )}
                  {t('auth.continueWithFacebook')}
                </button>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-semibold">{t('auth.or')}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Email input — clean pill with animated dot indicator (no double halo) */}
              <form onSubmit={handleEmailContinue}>
                <label htmlFor="email" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                  {t('auth.email')}
                </label>
                <div className="group relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    autoFocus
                    className="w-full h-full px-4 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 mt-3 rounded-full bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.continue')}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-[11px] text-red-600 text-center">{error}</p>
              )}

              {/* Forgot password direct entry */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setError(null) }}
                  className="text-[12px] text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>

              {/* Pro link — rounded-full pill with border like /louer filters */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                {isAgentMode ? (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-gray-200 text-[12px] font-medium text-gray-700 hover:border-gray-900 hover:shadow-sm transition-all"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    {t('auth.backToPersonal')}
                  </Link>
                ) : (
                  <Link
                    to="/login?role=agent"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-gray-200 text-[12px] text-gray-700 hover:border-gray-900 hover:shadow-sm transition-all"
                  >
                    {t('auth.youArePro')}{' '}
                    <span className="font-semibold text-gray-900">{t('auth.agentSpace')}</span>
                    <span className="text-gray-400">→</span>
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP: Login (email exists) ── */}
          {step === 'login' && (
            <motion.div key="login" {...stepMotion}>
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.welcomeBack')}</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleLogin}>
                <label htmlFor="password" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                  {t('auth.password')}
                </label>
                <div className="group relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                    autoFocus
                    className="w-full h-full px-4 pr-10 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900/20 cursor-pointer"
                    />
                    <span className="text-xs text-gray-600">Se souvenir de moi</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep('forgot'); setError(null) }}
                    className="text-xs text-gray-500 hover:text-accent transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-11 mt-5 rounded-full bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.signIn')}
                </button>
              </form>

              {/* Magic link alternative — buyers only, not for agent mode */}
              {!isAgentMode && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] uppercase tracking-wider text-gray-400">ou</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={loading}
                    className="w-full h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={2} />
                    Recevoir un lien de connexion
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    On t'envoie un lien par email, pas besoin de mot de passe.
                  </p>
                </>
              )}

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}
            </motion.div>
          )}

          {/* ── STEP: Magic link sent ── */}
          {step === 'magic-link-sent' && (
            <motion.div key="magic-link-sent" {...stepMotion}>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">Vérifie ta boîte mail</h1>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  On vient d'envoyer un lien de connexion à <strong className="text-gray-900">{email}</strong>. Clique dessus pour accéder à ton compte.
                </p>
                <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                  Le lien expire dans 1 heure. Pense à vérifier tes spams.
                </p>
                <button
                  onClick={goBack}
                  className="mt-6 text-sm text-gray-500 hover:text-accent transition-colors"
                >
                  Utiliser une autre adresse
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: Register (new email) ── */}
          {step === 'register' && (
            <motion.div key="register" {...stepMotion}>
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.createAccount')}</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label htmlFor="firstName" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                    {t('auth.firstName')}
                  </label>
                  <div className="relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoFocus
                      className="w-full h-full px-4 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                    {t('auth.lastName')}
                  </label>
                  <div className="relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-full px-4 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="regPassword" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                    {t('auth.password')} <span className="text-gray-400 font-medium normal-case">({t('auth.passwordMin')})</span>
                  </label>
                  <div className="relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                    <input
                      id="regPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full h-full px-4 pr-10 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !firstName.trim() || password.length < 8}
                  className="w-full h-11 !mt-4 rounded-full bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.createMyAccount')}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}

              <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
                {t('auth.acceptTerms')}{' '}
                <Link to="/privacy" className="underline hover:text-gray-600">{t('auth.termsOfUse')}</Link>
                {' '}{t('auth.and')}{' '}
                <Link to="/privacy" className="underline hover:text-gray-600">{t('auth.privacyPolicy')}</Link>.
              </p>
            </motion.div>
          )}

          {/* ── STEP: Forgot password ── */}
          {step === 'forgot' && (
            <motion.div key="forgot" {...stepMotion}>
              <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.forgotPasswordTitle')}</h1>
              <p className="text-sm text-gray-500 mb-6">
                Entre ton adresse email et nous t'envoyons un lien pour réinitialiser ton mot de passe.
              </p>

              <form onSubmit={handleForgotPassword}>
                <label htmlFor="forgotEmail" className="block text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                  {t('auth.email')}
                </label>
                <div className="group relative h-11 rounded-full bg-gray-50 border border-gray-100 focus-within:border-gray-900 focus-within:bg-white transition-colors duration-300">
                  <input
                    id="forgotEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    autoFocus
                    className="w-full h-full px-4 text-[13px] bg-transparent outline-none focus-visible:outline-none placeholder:text-gray-400 caret-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 mt-4 rounded-full bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.sendLink')}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}
            </motion.div>
          )}

          {/* ── STEP: Forgot password sent ── */}
          {step === 'forgot-sent' && (
            <motion.div key="forgot-sent" {...stepMotion}>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.emailSent')}</h1>
                <p className="text-sm text-gray-500">
                  {t('auth.checkInbox')} <strong>{email}</strong>.
                  {t('auth.clickResetLink')}
                </p>
                <button
                  onClick={() => { setStep('login'); setError(null) }}
                  className="mt-6 text-sm text-gray-500 hover:text-accent transition-colors"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
          </div>

          {/* Footer copyright — stays at bottom on desktop */}
          <p className="text-[11px] text-gray-400 text-center mt-10 lg:mt-auto">
            © {new Date().getFullYear()} MEGGA Real Estate · Suisse
          </p>
        </div>

        {/* Right: MEGGA showcase (desktop only) — inset bento with rounded corners on all 4 sides */}
        <div className="hidden lg:flex w-[52%] relative overflow-hidden bg-[#2D4FB3] rounded-[28px] m-4 p-10 xl:p-14 flex-col">
          {/* Subtle radial glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

          {/* Header copy */}
          <div className="relative z-10 mb-8">
            <h2 className="text-white text-[30px] xl:text-[34px] font-semibold leading-[1.15] tracking-tight">
              Gère ton immobilier suisse<br />
              comme jamais auparavant.
            </h2>
            <p className="text-white/75 text-[14px] mt-3 max-w-md leading-relaxed">
              Cherche, compare, suis tes biens favoris. Reçois des alertes et gère tes dossiers — sans jamais quitter MEGGA.
            </p>
          </div>

          {/* Central dashboard mockup + overlay popup — large "real software" feel */}
          <div className="relative flex-1 flex items-start justify-center pt-2">
            <div className="relative w-full max-w-[640px]">
            {/* MAIN: MEGGA CRM dashboard (capped width, centered in bento) */}
            <div
              className="w-full bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 30px 60px -20px rgba(15,23,42,0.4), 0 10px 20px -10px rgba(15,23,42,0.1)' }}
            >
              {/* Dashboard top bar */}
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[15px] font-semibold text-gray-900">Pipeline</p>
                  <div className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                    Tous les mandats
                    <ChevronDown className="h-3 w-3 text-gray-400 ml-0.5" strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
                    <ChevronLeft className="h-3 w-3 text-gray-400" strokeWidth={2} />
                    27 mars — 19 avr.
                    <ChevronDown className="h-3 w-3 text-gray-400 rotate-[-90deg]" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1.5">
                    {['#FDA4AF', '#FCD34D', '#86EFAC'].map((c, i) => (
                      <div key={i} className="h-6 w-6 rounded-full border-2 border-white" style={{ background: c }} />
                    ))}
                    <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 z-10">+2</div>
                  </div>
                  <button className="h-7 px-2.5 rounded-md bg-indigo-50 text-[11px] font-semibold text-[#2D4FB3] flex items-center gap-1">
                    Ajouter
                    <span className="text-[13px] leading-none">+</span>
                  </button>
                </div>
              </div>

              {/* KPI tiles row */}
              <div className="px-5 grid grid-cols-2 gap-3 pb-4">
                <div className="rounded-xl bg-gray-50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-gray-500">Mandats actifs <span className="text-gray-400">/ mois</span></p>
                    <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <span className="text-emerald-600">↑</span>
                      +23%
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[26px] font-bold text-gray-900 tabular-nums leading-none">12</p>
                      <p className="text-[9px] text-emerald-600 mt-1">+23% semaine dernière</p>
                    </div>
                    <svg className="h-10 w-24 -mr-1" viewBox="0 0 96 40" fill="none">
                      <defs>
                        <linearGradient id="grad1" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#111827" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M2 32 L14 26 L26 30 L38 18 L50 22 L62 12 L74 16 L86 6 L94 10 L94 40 L2 40 Z" fill="url(#grad1)" />
                      <path d="M2 32 L14 26 L26 30 L38 18 L50 22 L62 12 L74 16 L86 6 L94 10" stroke="#111827" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-gray-500">Visites <span className="text-gray-400">/ semaine</span></p>
                    <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <span>↑</span>
                      +18%
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[26px] font-bold text-gray-900 tabular-nums leading-none">8.5</p>
                      <p className="text-[9px] text-emerald-600 mt-1">+18% vs. objectif</p>
                    </div>
                    <svg className="h-10 w-24 -mr-1" viewBox="0 0 96 40" fill="none">
                      <defs>
                        <linearGradient id="grad2" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2D4FB3" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#2D4FB3" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M2 28 L14 24 L26 26 L38 14 L50 18 L62 8 L74 12 L86 4 L94 8 L94 40 L2 40 Z" fill="url(#grad2)" />
                      <path d="M2 28 L14 24 L26 26 L38 14 L50 18 L62 8 L74 12 L86 4 L94 8" stroke="#2D4FB3" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Table — MEGGA pipeline */}
              <div className="border-t border-gray-100">
                <div className="px-5 py-3">
                  <p className="text-[12px] font-semibold text-gray-900">Mandats — performance</p>
                </div>
                {/* Column headers */}
                <div className="px-5 grid grid-cols-[1fr_64px_72px_1fr_48px] gap-3 pb-1.5 text-[9px] uppercase tracking-[0.06em] text-gray-400 font-semibold">
                  <span>Bien</span>
                  <span>Priorité</span>
                  <span className="text-right">Avancé</span>
                  <span>Progression</span>
                  <span className="text-right">Valeur</span>
                </div>
                <div className="px-5 pb-4 divide-y divide-gray-100">
                  {[
                    { code: 'C', color: 'bg-rose-100 text-rose-600', name: 'Cologny', sub: '4.5 p. · 145 m²', prio: 'HAUTE', prioColor: 'bg-rose-50 text-rose-600', pct: '85%', w: 85, bar: 'bg-gray-900', val: '1.4M' },
                    { code: 'L', color: 'bg-amber-100 text-amber-600', name: 'Lausanne', sub: 'Villa · 210 m²', prio: 'MOYENNE', prioColor: 'bg-amber-50 text-amber-600', pct: '55%', w: 55, bar: 'bg-gray-900', val: '2.1M' },
                    { code: 'G', color: 'bg-indigo-100 text-indigo-600', name: 'Genève', sub: '3.5 p. · 88 m²', prio: 'HAUTE', prioColor: 'bg-rose-50 text-rose-600', pct: '35%', w: 35, bar: 'bg-gray-900', val: '850K' },
                    { code: 'M', color: 'bg-emerald-100 text-emerald-600', name: 'Montreux', sub: 'Loft · 120 m²', prio: 'BASSE', prioColor: 'bg-gray-100 text-gray-500', pct: '100%', w: 100, bar: 'bg-emerald-500', val: '1.2M' },
                  ].map((row) => (
                    <div key={row.name} className="grid grid-cols-[1fr_64px_72px_1fr_48px] gap-3 py-2 items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', row.color)}>{row.code}</div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-gray-900 truncate">{row.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{row.sub}</p>
                        </div>
                      </div>
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded justify-self-start', row.prioColor)}>{row.prio}</span>
                      <span className="text-[11px] font-semibold text-gray-900 tabular-nums text-right">{row.pct}</span>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', row.bar)} style={{ width: `${row.w}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-900 tabular-nums text-right">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* OVERLAY POPUP — Ajouter un contact, positioned over the right side of the main card */}
            <div
              className="absolute top-[22%] -right-4 w-[240px] bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 28px 56px -16px rgba(15,23,42,0.5)' }}
            >
              <div className="px-4 pt-3.5 pb-2 flex items-center justify-between border-b border-gray-100">
                <p className="text-[12px] font-semibold text-gray-900">Ajouter un contact</p>
                <X className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
              </div>
              <div className="px-4 pt-3 pb-3 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Email</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-7 px-2.5 rounded-md bg-gray-50 border border-gray-100 flex items-center text-[11px] text-gray-700 truncate">
                      julien@megga.ch
                    </div>
                    <button className="h-7 px-2 rounded-md bg-[#2D4FB3] text-white text-[10px] font-semibold whitespace-nowrap">Inviter</button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1.5">Équipe</p>
                  <div className="space-y-1.5">
                    {[
                      { n: 'Gregory L.', r: 'Propriétaire', c: '#FCD34D' },
                      { n: 'Sophie M.', r: 'Éditeur', c: '#FDA4AF' },
                      { n: 'Robert F.', r: 'Éditeur', c: '#86EFAC' },
                    ].map((p) => (
                      <div key={p.n} className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full shrink-0" style={{ background: p.c }} />
                        <p className="text-[11px] text-gray-900 flex-1 truncate">{p.n}</p>
                        <span className="text-[9px] text-gray-500 shrink-0">{p.r}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-1">Lien de partage</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-7 px-2.5 rounded-md bg-gray-50 border border-gray-100 flex items-center text-[10px] text-gray-500 truncate font-mono">
                      megga.ch/p/m-9a3b7…
                    </div>
                    <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] font-semibold text-gray-700 whitespace-nowrap">Copier</button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Bottom — stats row */}
          <div className="relative z-10 mt-auto pt-6 border-t border-white/15 flex items-center justify-between gap-4">
            {[
              { v: '26', l: 'cantons' },
              { v: '4', l: 'langues' },
              { v: '33K+', l: 'biens' },
              { v: '100%', l: 'compliance' },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-white text-lg font-semibold tabular-nums tracking-tight">{s.v}</p>
                <p className="text-white/60 text-[11px]">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Trust logos row */}
          <div className="relative z-10 mt-5 pt-4 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/50 mb-2.5">Conforme & certifié</p>
            <div className="flex items-center gap-6 opacity-75">
              <a href="https://c2pa.org" target="_blank" rel="noopener noreferrer" title="C2PA — authenticité des contenus" className="hover:opacity-100 transition-opacity">
                <img src="/c2pa-logo.svg" alt="C2PA" className="h-7 brightness-0 invert" />
              </a>
              <a href="https://www.swissmadesoftware.org" target="_blank" rel="noopener noreferrer" title="Swiss Made Software" className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
                <svg viewBox="4 7 44 38" className="h-6 w-auto flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M45.28,42.51H9.24c-1.76,0-3.18-1.43-3.18-3.18v-20.16c0-.43.09-.86.26-1.26l3.07-7.15c.5-1.17,1.65-1.92,2.92-1.92h13.36c1.3,0,2.47.79,2.95,2,0,0,.51,1.26,1,2.5h15.66c1.76,0,3.18,1.42,3.18,3.18v22.81c0,1.76-1.42,3.18-3.18,3.18M21.43,25.97c-1.03,0-1.57.79-1.57,1.57s.54,1.57,1.57,1.57h4.33v4.34c0,1.03.78,1.57,1.57,1.57s1.57-.54,1.57-1.57v-4.34h4.33c1.03,0,1.57-.79,1.57-1.57s-.54-1.57-1.57-1.57h-4.33v-4.34c0-1.03-.78-1.57-1.57-1.57s-1.57.54-1.57,1.57v4.34h-4.33" fill="#fff"/>
                </svg>
                <img src="/sms-wordmark.svg" alt="Swiss Made Software" className="h-6 w-auto object-contain brightness-0 invert" loading="lazy" />
              </a>
              <a href="https://anthropic.com" target="_blank" rel="noopener noreferrer" title="Built with Claude by Anthropic" className="hover:opacity-100 transition-opacity">
                <img src="/claude-ai-logo.svg" alt="Claude AI" className="h-5 w-auto object-contain brightness-0 invert" loading="lazy" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
