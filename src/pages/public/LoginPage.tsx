// MEGGA — LoginPage (port 1:1 du proto Claude Design : megga-auth-shell.jsx
// + megga-auth-modal.jsx + megga-auth-form.jsx).
//
// Architecture :
// - State `view` : 'choice' | 'particulier' | 'agent'
//   · 'choice' → AuthChoice fullscreen (sélection particulier/agent)
//   · 'particulier' / 'agent' → split-screen (form gauche + preview droite)
// - State `step` : 'email' | 'login' | 'register' | 'forgot' | 'forgot-sent'
//   | 'magic-link-sent' (préservé de l'ancien LoginPage pour compatibilité)
// - URL `?role=agent` ouvre directement sur view='agent'
//
// Toute la logique auth (Supabase signIn, OAuth, magic link, password reset)
// est préservée — c'est seulement la couche visuelle qui est refondue.

import { useState, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { REMEMBER_KEY, supabase } from '@/lib/supabase'
import { isAgentRole, type UserRole } from '@/types/auth'
import GoogleOneTap from '@/components/auth/GoogleOneTap'
import AuthChoice from '@/components/auth/AuthChoice'
import ParticulierPreview from '@/components/auth/ParticulierPreview'
import AgentPreview from '@/components/auth/AgentPreview'
import { MFAChallengeModal } from '@/components/auth/MfaModals'
import { MFALostDeviceModal } from '@/components/auth/MfaResetFlow'
import { AUTH_FONT, AUTH_M } from '@/components/auth/authTokens'

// localStorage flag — opt-in pour la démo visuelle du flow MFA challenge.
// En prod (post-Supabase MFA wiring), il sera remplacé par la vérification
// `user.factors` retournée par Supabase Auth après le signIn.
const MFA_DEMO_FLAG = 'megga_mfa_demo'

type View = 'choice' | 'particulier' | 'agent'
type Step =
  | 'email'
  | 'login'
  | 'register'
  | 'forgot'
  | 'forgot-sent'
  | 'magic-link-sent'

// ── OAuth icons ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8c-.2 1.1-.8 2.1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.8v2.4C2.3 15.9 5.4 18 9 18z" />
      <path fill="#FBBC04" d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V4.9H.8C.3 6.1 0 7.5 0 9s.3 2.9.8 4.1l3.1-2.4z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6C13.5.9 11.4 0 9 0 5.4 0 2.3 2.1.8 5.1l3.1 2.4C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M18 9c0-4.97-4.03-9-9-9S0 4.03 0 9c0 4.49 3.29 8.21 7.59 8.89v-6.29H5.31V9h2.28V7.02c0-2.25 1.34-3.49 3.39-3.49.98 0 2.01.18 2.01.18v2.21h-1.13c-1.12 0-1.46.69-1.46 1.4V9h2.49l-.4 2.6h-2.09v6.29C14.71 17.21 18 13.49 18 9z" fill="#1877F2" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect x="0" y="0" width="8" height="8" fill="#F25022" />
      <rect x="10" y="0" width="8" height="8" fill="#7FBA00" />
      <rect x="0" y="10" width="8" height="8" fill="#00A4EF" />
      <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
    </svg>
  )
}

// ── SsoButton + TextField (atoms styled to match proto) ──────────────────

interface SsoButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

function SsoButton({ icon, label, onClick, disabled, loading }: SsoButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 48,
        padding: '0 16px',
        background: '#fff',
        border: `1px solid ${AUTH_M.border}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontFamily: AUTH_FONT,
        fontSize: 14,
        fontWeight: 600,
        color: AUTH_M.ink,
        transition:
          'border-color 0.2s ease, background 0.2s ease, transform 0.1s ease',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = AUTH_M.ink
          e.currentTarget.style.background = '#F2F4F8'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = AUTH_M.border
        e.currentTarget.style.background = '#fff'
      }}
    >
      {loading ? <Loader2 width={18} height={18} className="animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

interface TextFieldProps {
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  required?: boolean
  autoFocus?: boolean
  showPasswordToggle?: boolean
  onTogglePassword?: () => void
  passwordVisible?: boolean
  minLength?: number
}

function TextField({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  autoFocus,
  showPasswordToggle,
  onTogglePassword,
  passwordVisible,
  minLength,
}: TextFieldProps) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 12,
          fontWeight: 600,
          color: AUTH_M.soft,
          marginBottom: 6,
          letterSpacing: 0.1,
        }}
      >
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          minLength={minLength}
          style={{
            width: '100%',
            height: 46,
            padding: showPasswordToggle ? '0 44px 0 14px' : '0 14px',
            background: '#fff',
            border: `1px solid ${AUTH_M.border}`,
            borderRadius: 10,
            fontFamily: AUTH_FONT,
            fontSize: 14,
            color: AUTH_M.ink,
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxSizing: 'border-box',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = AUTH_M.ink
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,20,16,0.06)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = AUTH_M.border
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: AUTH_M.muted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            tabIndex={-1}
          >
            {passwordVisible ? <EyeOff width={16} height={16} /> : <Eye width={16} height={16} />}
          </button>
        )}
      </div>
    </label>
  )
}

// ── Main LoginPage ────────────────────────────────────────────────────────

export default function LoginPage() {
  const {
    user,
    profile,
    loading: authLoading,
    signInWithPassword,
    signInWithEmail,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithFacebook,
    signUp,
    resetPassword,
  } = useAuth()
  const [searchParams] = useSearchParams()

  const isAgentMode = searchParams.get('role') === 'agent'

  const [view, setView] = useState<View>(isAgentMode ? 'agent' : 'choice')
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [agency, setAgency] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(REMEMBER_KEY) !== 'false'
  })
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<
    'google' | 'facebook' | 'microsoft' | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  // MFA challenge state — gate le redirect post-login si MFA est activée.
  const [mfaChallengeOpen, setMfaChallengeOpen] = useState(false)
  const [mfaPassed, setMfaPassed] = useState(false)
  const [lostDeviceOpen, setLostDeviceOpen] = useState(false)

  const isAgent = view === 'agent'

  // Vérifie si MFA est requise (en prod : factors Supabase ; ici : flag demo).
  const mfaRequired =
    typeof window !== 'undefined' &&
    window.localStorage.getItem(MFA_DEMO_FLAG) === '1'

  // Persist redirect URL
  useEffect(() => {
    const redirect = searchParams.get('redirect')
    if (redirect) sessionStorage.setItem('megga_redirect', redirect)
  }, [searchParams])

  // Persist remember preference
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  }, [remember])

  // Ouvre le MFA challenge dès que l'utilisateur est logué et que MFA est
  // requise (mais pas encore validée). Ne s'ouvre qu'une seule fois par
  // session de login.
  useEffect(() => {
    if (!authLoading && user && mfaRequired && !mfaPassed && !mfaChallengeOpen) {
      setMfaChallengeOpen(true)
    }
  }, [authLoading, user, mfaRequired, mfaPassed, mfaChallengeOpen])

  // Already logged in → redirect (gated by MFA si requis)
  const canRedirect = !mfaRequired || mfaPassed

  if (!authLoading && user && profile && canRedirect) {
    const redirect = sessionStorage.getItem('megga_redirect')
    if (redirect) {
      sessionStorage.removeItem('megga_redirect')
      return <Navigate to={redirect} replace />
    }
    if (isAgentRole(profile.role)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/acheter" replace />
  }
  if (!authLoading && user && !profile && canRedirect) {
    const metaRole = user.user_metadata?.role as string | undefined
    if (metaRole && isAgentRole(metaRole as UserRole))
      return <Navigate to="/dashboard" replace />
    return <Navigate to="/acheter" replace />
  }


  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('check_email_exists', {
      p_email: email.trim(),
    })
    setLoading(false)
    if (err) {
      // Fallback : on bascule sur login en cas d'erreur RPC, l'utilisateur
      // pourra cliquer 'Créer un compte' depuis cet écran si besoin.
      setStep('login')
      return
    }
    setStep(data === true ? 'login' : 'register')
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
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (isAgent && !agency.trim()) {
      setError('Le nom de l’agence est requis')
      return
    }
    if (!isAgent && !firstName.trim()) {
      setError('Le prénom est requis')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    setLoading(true)
    setError(null)
    const fullName = isAgent
      ? agency.trim()
      : `${firstName.trim()} ${lastName.trim()}`.trim()
    const role: UserRole = isAgent ? 'agent' : 'particulier'
    const { error: err } = await signUp(email.trim(), password, fullName, role)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
  }

  async function handleSso(provider: 'google' | 'facebook' | 'microsoft') {
    setOauthLoading(provider)
    setError(null)
    const redirect = searchParams.get('redirect') || (isAgent ? '/dashboard' : '/acheter')
    sessionStorage.setItem('megga_redirect', redirect)
    if (isAgent) localStorage.setItem('megga_oauth_role', 'agent')
    const fn =
      provider === 'google'
        ? signInWithGoogle
        : provider === 'facebook'
          ? signInWithFacebook
          : signInWithMicrosoft
    const { error: err } = await fn(isAgent ? 'agent' : undefined)
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
    if (err) {
      setError(err)
      return
    }
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

  function backToEmail() {
    setStep('email')
    setPassword('')
    setError(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        background: AUTH_M.section,
        fontFamily: AUTH_FONT,
        padding: 'clamp(8px, 2vw, 24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GoogleOneTap disabled={isAgent || !!user} />

      {view === 'choice' ? (
        <ChoiceShell onChoose={setView} />
      ) : (
        <SplitShell
          isAgent={isAgent}
        >
          <FormColumn
            isAgent={isAgent}
            step={step}
            setStep={setStep}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            agency={agency}
            setAgency={setAgency}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            remember={remember}
            setRemember={setRemember}
            loading={loading}
            oauthLoading={oauthLoading}
            error={error}
            setError={setError}
            onEmailContinue={handleEmailContinue}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onSso={handleSso}
            onMagicLink={handleMagicLink}
            onForgotPassword={handleForgotPassword}
            onBackToEmail={backToEmail}
          />
        </SplitShell>
      )}

      {/* MFA challenge — bloque le redirect tant que pas validé */}
      {mfaChallengeOpen && (
        <MFAChallengeModal
          onClose={() => {
            // Si l'utilisateur ferme sans valider → on log out pour repartir clean.
            // (Sinon il resterait logué Supabase mais bloqué sur /login.)
            setMfaChallengeOpen(false)
            // NB: on ne déclenche pas signOut() ici pour éviter une boucle.
            // L'utilisateur peut soit reverify, soit cliquer "j'ai perdu mon
            // téléphone", soit fermer l'onglet.
          }}
          onSuccess={() => {
            setMfaChallengeOpen(false)
            setMfaPassed(true)
            // Le useEffect de redirect va maintenant fire car canRedirect=true.
          }}
          onLostDevice={() => {
            setMfaChallengeOpen(false)
            setLostDeviceOpen(true)
          }}
        />
      )}

      {lostDeviceOpen && (
        <MFALostDeviceModal
          onClose={() => setLostDeviceOpen(false)}
          onSubmitted={() => {
            setLostDeviceOpen(false)
            // Demande envoyée à l'admin · l'utilisateur est notifié par toast
            // dans MFALostDeviceModal puis le modal se ferme. Reste sur /login.
          }}
        />
      )}
    </main>
  )
}

// ── Choice shell (proto megga-auth-shell.jsx) ────────────────────────────

function ChoiceShell({ onChoose }: { onChoose: (view: View) => void }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1080,
        background: '#fff',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.15)',
        padding: '60px 0 50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 36,
      }}
    >
      <Link to="/" style={{ display: 'inline-block' }}>
        <img src="/megga-logo.svg" alt="MEGGA" style={{ height: 24, width: 'auto' }} />
      </Link>
      <AuthChoice onChoose={view => onChoose(view)} />
    </div>
  )
}

// ── Split-screen shell ────────────────────────────────────────────────────

interface SplitShellProps {
  isAgent: boolean
  children: React.ReactNode
}

function SplitShell({ isAgent, children }: SplitShellProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1200,
        height: 'min(720px, calc(100vh - 24px))',
        background: '#fff',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
        position: 'relative',
      }}
    >
      {/* Left — form */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(40px, 5vw, 68px) 0 60px',
          overflow: 'auto',
          position: 'relative',
          alignItems: 'center',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '0 32px',
            marginBottom: 32,
          }}
        >
          <Link to="/">
            <img src="/megga-logo.svg" alt="MEGGA" style={{ height: 22, width: 'auto' }} />
          </Link>
        </div>
        {children}
      </div>

      {/* Right — preview */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'none',
        }}
        className="auth-preview-pane"
      >
        {isAgent ? <AgentPreview /> : <ParticulierPreview />}
      </div>

      <style>{`
        @media (min-width: 960px) {
          .auth-preview-pane { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ── Form column ──────────────────────────────────────────────────────────

interface FormColumnProps {
  isAgent: boolean
  step: Step
  setStep: (s: Step) => void
  email: string
  setEmail: (s: string) => void
  password: string
  setPassword: (s: string) => void
  firstName: string
  setFirstName: (s: string) => void
  lastName: string
  setLastName: (s: string) => void
  agency: string
  setAgency: (s: string) => void
  showPassword: boolean
  setShowPassword: (b: boolean) => void
  remember: boolean
  setRemember: (b: boolean) => void
  loading: boolean
  oauthLoading: 'google' | 'facebook' | 'microsoft' | null
  error: string | null
  setError: (s: string | null) => void
  onEmailContinue: (e: React.FormEvent) => void
  onLogin: (e: React.FormEvent) => void
  onRegister: (e: React.FormEvent) => void
  onSso: (provider: 'google' | 'facebook' | 'microsoft') => void
  onMagicLink: () => void
  onForgotPassword: (e: React.FormEvent) => void
  onBackToEmail: () => void
}

function FormColumn(props: FormColumnProps) {
  const {
    isAgent, step, setStep, email, setEmail, password, setPassword,
    firstName, setFirstName, lastName, setLastName, agency, setAgency,
    showPassword, setShowPassword, remember, setRemember, loading,
    oauthLoading, error, setError, onEmailContinue, onLogin, onRegister, onSso,
    onMagicLink, onForgotPassword, onBackToEmail,
  } = props

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        padding: '0 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {step === 'email' ? (
        <>
          <TitleBlock
            title="Connexion ou inscription"
            subtitle={
              isAgent
                ? 'Accédez à votre CRM ou créez votre agence en 30 secondes.'
                : 'Connectez-vous ou créez votre compte gratuit en 30 secondes.'
            }
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SsoButton
              icon={isAgent ? <MicrosoftIcon /> : <GoogleIcon />}
              label={isAgent ? 'Microsoft 365' : 'Continuer avec Google'}
              onClick={() => onSso(isAgent ? 'microsoft' : 'google')}
              disabled={!!oauthLoading}
              loading={oauthLoading === (isAgent ? 'microsoft' : 'google')}
            />
            <SsoButton
              icon={isAgent ? <GoogleIcon /> : <FacebookIcon />}
              label={isAgent ? 'Google Workspace' : 'Continuer avec Facebook'}
              onClick={() => onSso(isAgent ? 'google' : 'facebook')}
              disabled={!!oauthLoading}
              loading={oauthLoading === (isAgent ? 'google' : 'facebook')}
            />
            <SsoButton
              icon={isAgent ? <FacebookIcon /> : <MicrosoftIcon />}
              label={isAgent ? 'Facebook Business' : 'Continuer avec Microsoft'}
              onClick={() => onSso(isAgent ? 'facebook' : 'microsoft')}
              disabled={!!oauthLoading}
              loading={oauthLoading === (isAgent ? 'facebook' : 'microsoft')}
            />
          </div>

          <Divider />

          <form onSubmit={onEmailContinue} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField
              label="Email professionnel"
              type="email"
              placeholder={isAgent ? 'vous@votre-agence.ch' : 'vous@exemple.ch'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
            <SubmitButton loading={loading} disabled={!email.trim()} label="Continuer" />
          </form>

          {error && <ErrorText>{error}</ErrorText>}

          <button
            type="button"
            onClick={() => { setStep('forgot') }}
            style={{
              alignSelf: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: AUTH_FONT,
              fontSize: 12,
              color: AUTH_M.soft,
              padding: 0,
            }}
          >
            Mot de passe oublié ?
          </button>

          <LegalFooter />
        </>
      ) : step === 'login' ? (
        <>
          <BackButton onClick={onBackToEmail} />
          <TitleBlock
            title="Connexion"
            subtitle={email}
          />

          <form onSubmit={onLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
              showPasswordToggle
              onTogglePassword={() => setShowPassword(!showPassword)}
              passwordVisible={showPassword}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: AUTH_M.soft }}>Se souvenir de moi</span>
              </label>
              <button
                type="button"
                onClick={() => setStep('forgot')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: AUTH_FONT,
                  fontSize: 12,
                  color: AUTH_M.soft,
                  padding: 0,
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
            <SubmitButton loading={loading} disabled={!password} label="Se connecter" />
          </form>

          {!isAgent && (
            <>
              <Divider />
              <SsoButton
                icon={<Mail width={18} height={18} />}
                label="Recevoir un lien de connexion"
                onClick={onMagicLink}
                disabled={loading}
              />
            </>
          )}

          <div
            style={{
              fontFamily: AUTH_FONT,
              fontSize: 13,
              color: AUTH_M.soft,
              textAlign: 'center',
            }}
          >
            Pas encore de compte ?{' '}
            <button
              type="button"
              onClick={() => { setPassword(''); setError(null); setStep('register') }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: AUTH_FONT,
                fontSize: 13,
                fontWeight: 600,
                color: AUTH_M.ink,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {isAgent ? 'Créer mon agence' : 'Créer un compte'}
            </button>
          </div>

          {error && <ErrorText>{error}</ErrorText>}
        </>
      ) : step === 'register' ? (
        <>
          <BackButton onClick={onBackToEmail} />
          <TitleBlock
            title={isAgent ? 'Créer mon agence' : 'Créer un compte'}
            subtitle={email}
          />

          <form onSubmit={onRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isAgent ? (
              <TextField
                label="Nom de l'agence"
                placeholder="Ex. Aebischer Immobilier SA"
                value={agency}
                onChange={e => setAgency(e.target.value)}
                autoComplete="organization"
                required
                autoFocus
              />
            ) : (
              <>
                <TextField
                  label="Prénom"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                  autoFocus
                />
                <TextField
                  label="Nom"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </>
            )}
            <TextField
              label="Mot de passe (8 caractères min.)"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              showPasswordToggle
              onTogglePassword={() => setShowPassword(!showPassword)}
              passwordVisible={showPassword}
            />
            <SubmitButton
              loading={loading}
              disabled={password.length < 8 || (isAgent ? !agency.trim() : !firstName.trim())}
              label={isAgent ? 'Créer mon agence' : 'Créer mon compte'}
            />
          </form>

          <div
            style={{
              fontFamily: AUTH_FONT,
              fontSize: 13,
              color: AUTH_M.soft,
              textAlign: 'center',
            }}
          >
            Vous avez déjà un compte ?{' '}
            <button
              type="button"
              onClick={() => { setPassword(''); setError(null); setStep('login') }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: AUTH_FONT,
                fontSize: 13,
                fontWeight: 600,
                color: AUTH_M.ink,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Se connecter
            </button>
          </div>

          {error && <ErrorText>{error}</ErrorText>}
          <LegalFooter />
        </>
      ) : step === 'forgot' ? (
        <>
          <BackButton onClick={onBackToEmail} />
          <TitleBlock
            title="Mot de passe oublié ?"
            subtitle="Entrez votre email · nous vous enverrons un lien pour le réinitialiser."
          />
          <form onSubmit={onForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField
              label="Email"
              type="email"
              placeholder="vous@exemple.ch"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
            <SubmitButton loading={loading} disabled={!email.trim()} label="Envoyer le lien" />
          </form>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      ) : step === 'forgot-sent' ? (
        <SuccessPanel
          icon="check"
          title="Email envoyé"
          body={`Vérifiez votre boîte ${email}. Cliquez sur le lien reçu pour réinitialiser votre mot de passe.`}
          onBack={() => { setStep('login') }}
          backLabel="Retour à la connexion"
        />
      ) : step === 'magic-link-sent' ? (
        <SuccessPanel
          icon="mail"
          title="Vérifiez votre boîte mail"
          body={`Lien de connexion envoyé à ${email}. Cliquez dessus pour accéder à votre compte. Le lien expire dans 1 heure.`}
          onBack={onBackToEmail}
          backLabel="Utiliser une autre adresse"
        />
      ) : null}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function TitleBlock({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div>
      <h2
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 'clamp(24px, 3.5vw, 32px)',
          fontWeight: 700,
          color: AUTH_M.ink,
          margin: 0,
          letterSpacing: -0.8,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 14,
          color: AUTH_M.soft,
          margin: '8px 0 0',
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: AUTH_M.border }} />
      <div
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 11,
          fontWeight: 600,
          color: AUTH_M.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        ou
      </div>
      <div style={{ flex: 1, height: 1, background: AUTH_M.border }} />
    </div>
  )
}

function SubmitButton({
  loading,
  disabled,
  label,
}: {
  loading: boolean
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      style={{
        height: 50,
        border: 'none',
        borderRadius: 10,
        background: AUTH_M.ink,
        color: '#fff',
        fontFamily: AUTH_FONT,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 0.1,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'transform 0.1s ease, background 0.2s ease',
        opacity: loading || disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!loading && !disabled) e.currentTarget.style.background = '#1f261c'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = AUTH_M.ink
      }}
    >
      {loading ? (
        <Loader2 width={18} height={18} className="animate-spin" />
      ) : (
        <>
          {label}
          <span>→</span>
        </>
      )}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        alignSelf: 'flex-start',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: AUTH_FONT,
        fontSize: 12,
        fontWeight: 600,
        color: AUTH_M.muted,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 0,
      }}
    >
      <span>←</span> Retour
    </button>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: AUTH_FONT,
        fontSize: 12,
        color: '#C0392B',
        textAlign: 'center',
      }}
    >
      {children}
    </p>
  )
}

function LegalFooter() {
  return (
    <div
      style={{
        fontFamily: AUTH_FONT,
        fontSize: 11,
        color: AUTH_M.muted,
        lineHeight: 1.5,
        textAlign: 'center',
      }}
    >
      En continuant, vous acceptez les{' '}
      <Link to="/cgu" style={{ color: AUTH_M.soft, textDecoration: 'underline' }}>
        CGU
      </Link>{' '}
      et la{' '}
      <Link to="/privacy" style={{ color: AUTH_M.soft, textDecoration: 'underline' }}>
        politique de confidentialité
      </Link>
      . Données hébergées en Suisse · conformité nLPD/RGPD.
    </div>
  )
}

function SuccessPanel({
  icon,
  title,
  body,
  onBack,
  backLabel,
}: {
  icon: 'check' | 'mail'
  title: string
  body: string
  onBack: () => void
  backLabel: string
}) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: icon === 'mail' ? AUTH_M.ink : '#E8F5E9',
          color: icon === 'mail' ? '#fff' : '#2D7A2D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        {icon === 'mail' ? (
          <Mail width={28} height={28} strokeWidth={2} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </div>
      <h2
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 22,
          fontWeight: 700,
          color: AUTH_M.ink,
          margin: 0,
          letterSpacing: -0.5,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 14,
          color: AUTH_M.soft,
          marginTop: 12,
          lineHeight: 1.5,
          maxWidth: 360,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {body}
      </p>
      <button
        onClick={onBack}
        style={{
          marginTop: 24,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: AUTH_FONT,
          fontSize: 13,
          fontWeight: 600,
          color: AUTH_M.soft,
        }}
      >
        {backLabel}
      </button>
    </div>
  )
}
