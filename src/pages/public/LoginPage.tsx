import { useState, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, Eye, EyeOff, Sparkles, ShieldCheck, MapPin, TrendingUp, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
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

// ── Types ────────────────────────────────────────────────────────────────

type Step = 'email' | 'login' | 'register' | 'forgot' | 'forgot-sent'

// ── Background image ────────────────────────────────────────────────────

// ── Main component ──────────────────────────────────────────────────────

export default function LoginPage() {
  const { t } = useTranslation('common')
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
    <main id="main-content" className="min-h-screen bg-gray-100 lg:p-4 flex">
      <div className="flex-1 bg-white lg:rounded-3xl lg:shadow-[0_20px_50px_-20px_rgba(15,23,42,0.15)] overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col px-6 py-10 lg:px-12 lg:py-10 bg-white relative">
          {/* Facebook toast */}
          {fbToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {t('auth.facebookSoon')}
            </div>
          )}

          {/* Logo top-left */}
          <Link to="/" className="inline-block self-start mb-auto">
            <img src="/megga-logo.svg" alt="MEGGA" className="h-7" />
          </Link>

          <div className="w-full max-w-sm mx-auto -mt-8 lg:mt-0">

          {/* ── STEP: Email (identifier) ── */}
          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-xl font-semibold text-gray-900">
                  {isAgentMode ? t('auth.professionalSpace') : t('auth.welcomeToMegga')}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {t('auth.loginOrCreate')}
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
                  {t('auth.continueWithGoogle')}
                </button>

                <button
                  onClick={handleFacebook}
                  disabled={!!oauthLoading}
                  className="w-full h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <FacebookIcon className="h-5 w-5" />
                  {t('auth.continueWithFacebook')}
                </button>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-500">{t('auth.or')}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Email input */}
              <form onSubmit={handleEmailContinue}>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoFocus
                  className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 mt-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.continue')}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
              )}

              {/* Pro link */}
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                {isAgentMode ? (
                  <Link to="/login" className="text-sm text-gray-500 hover:text-accent transition-colors">
                    {t('auth.backToPersonal')}
                  </Link>
                ) : (
                  <Link to="/login?role=agent" className="text-sm text-gray-500 hover:text-accent transition-colors">
                    {t('auth.youArePro')} <span className="font-medium">{t('auth.agentSpace')}</span> &rarr;
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
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.welcomeBack')}</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleLogin}>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                    autoFocus
                    className="w-full h-11 px-3.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
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
                  {t('auth.forgotPassword')}
                </button>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-11 mt-5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.signIn')}
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
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.createAccount')}</h1>
              <p className="text-sm text-gray-500 mb-6">{email}</p>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.firstName')}
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
                    {t('auth.lastName')}
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
                    {t('auth.password')} <span className="text-gray-500 font-normal">({t('auth.passwordMin')})</span>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
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
            </>
          )}

          {/* ── STEP: Forgot password ── */}
          {step === 'forgot' && (
            <>
              <button onClick={() => { setStep('login'); setError(null) }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back')}
              </button>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.forgotPasswordTitle')}</h1>
              <p className="text-sm text-gray-500 mb-6">
                {t('auth.resetLinkSent')} <strong>{email}</strong>
              </p>

              <form onSubmit={handleForgotPassword}>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.sendLink')}
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
            </>
          )}
          </div>

          {/* Footer copyright — stays at bottom on desktop */}
          <p className="text-[11px] text-gray-400 text-center mt-10 lg:mt-auto">
            © {new Date().getFullYear()} MEGGA Real Estate · Suisse
          </p>
        </div>

        {/* Right: MEGGA showcase (desktop only) */}
        <div className="hidden lg:flex w-[52%] relative overflow-hidden bg-gradient-to-br from-[#2563EB] via-[#1E4FD4] to-[#1E3A8A] p-10 xl:p-14 flex-col">
          {/* Ambient light blobs */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-10 -left-20 h-72 w-72 rounded-full bg-[#60A5FA]/20 blur-3xl" />

          {/* Header copy */}
          <div className="relative z-10">
            <h2 className="text-white text-[28px] xl:text-[32px] font-semibold leading-[1.15] tracking-tight">
              L'OS immobilier suisse,<br />
              <span className="text-white/80">pensé pour vous.</span>
            </h2>
            <p className="text-white/70 text-[14px] mt-3 max-w-md leading-relaxed">
              Cherchez, comparez, suivez vos biens favoris. Recevez des alertes et gérez vos dossiers — sans jamais quitter MEGGA.
            </p>
          </div>

          {/* Floating preview cards */}
          <div className="relative flex-1 mt-8">
            {/* Card 1 — Pipeline mini */}
            <div
              className="absolute top-0 left-0 w-[290px] bg-white/95 backdrop-blur-xl rounded-2xl p-4 border border-white/40"
              style={{ boxShadow: '0 24px 48px -20px rgba(15,23,42,0.35)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Pipeline</p>
                <span className="text-[10px] text-emerald-600 font-semibold">+12% · 30 j</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">12</span>
                <span className="text-[12px] text-gray-500">mandats actifs</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Prospection', n: 4, w: 60 },
                  { label: 'Visites', n: 5, w: 75 },
                  { label: 'Offre', n: 3, w: 45 },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-gray-600">{s.label}</span>
                      <span className="text-[11px] text-gray-900 tabular-nums font-semibold">{s.n}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-900 rounded-full" style={{ width: `${s.w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2 — AI matching */}
            <div
              className="absolute top-[38%] right-0 w-[260px] bg-white/95 backdrop-blur-xl rounded-2xl p-4 border border-white/40"
              style={{ boxShadow: '0 24px 48px -20px rgba(15,23,42,0.35)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-gray-900 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" strokeWidth={2.25} />
                </div>
                <p className="text-[12px] font-semibold text-gray-900">Matching IA</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { addr: 'Cologny, 4.5 p.', score: 94 },
                  { addr: 'Carouge, 3.5 p.', score: 87 },
                ].map((m) => (
                  <div key={m.addr} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="h-3 w-3 text-gray-400 shrink-0" strokeWidth={2} />
                      <span className="text-[12px] text-gray-700 truncate">{m.addr}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-900 tabular-nums">{m.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3 — LAB/KYC badge */}
            <div
              className="absolute bottom-8 left-6 w-[280px] bg-white/95 backdrop-blur-xl rounded-2xl p-4 border border-white/40"
              style={{ boxShadow: '0 24px 48px -20px rgba(15,23,42,0.35)' }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-gray-900">LAB/KYC conforme</p>
                  <p className="text-[11px] text-gray-500">Dilisense · 26 cantons · 4 langues</p>
                </div>
                <Check className="h-4 w-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              </div>
            </div>

            {/* Card 4 — Marketplace mini */}
            <div
              className="absolute top-[10%] right-[32%] w-[170px] bg-white/95 backdrop-blur-xl rounded-2xl p-3 border border-white/40"
              style={{ boxShadow: '0 24px 48px -20px rgba(15,23,42,0.35)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-gray-900" strokeWidth={2.25} />
                <p className="text-[11px] font-semibold text-gray-900">Marketplace</p>
              </div>
              <p className="text-[18px] font-bold text-gray-900 tabular-nums leading-none">33'122</p>
              <p className="text-[10px] text-gray-500 mt-0.5">annonces · Suisse</p>
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
        </div>
      </div>
    </main>
  )
}
