// MEGGA Auth — Shell principal (top-bar + bento form card centered)
// Source : handoff-auth/auth/megga-auth-bento.jsx → AuthBentoApp
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { BENTO_GLOBAL_CSS, bentoTokens } from './tokens'
import { BentoLogoGG } from './primitives'
import { BentoPortalToggle, BentoThemeToggle, type Portail } from './toggles'
import {
  BentoFormCard,
  type AuthHandlers,
  type AuthState,
} from './BentoFormCard'
import { logAuthEvent } from './auditLog'
import { useIsMobile } from './useIsMobile'

// ─── Theme persistence (cookie megga.theme) ──────────────────────────

const COOKIE_KEY = 'megga.theme'

function readThemeCookie(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_KEY}=`))
  if (!match) return null
  const v = match.split('=')[1]
  return v === 'dark' || v === 'light' ? v : null
}

function writeThemeCookie(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_KEY}=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`
  document.documentElement.dataset.theme = theme
}

function resolveInitialTheme(): 'light' | 'dark' {
  const cookie = readThemeCookie()
  if (cookie) return cookie
  if (typeof window !== 'undefined') {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  }
  return 'light'
}

// ─── Map (path, query) → portail + etat ──────────────────────────────

export type AuthRoute =
  | { portail: 'particulier'; etat: 'initial' }
  | { portail: 'particulier'; etat: 'sent' }
  | { portail: 'particulier'; etat: 'error' }
  | { portail: 'agent'; etat: 'signin' }
  | { portail: 'agent'; etat: 'signup' }
  | { portail: 'agent'; etat: 'verifyEmail' }
  | { portail: 'agent'; etat: 'reset' }
  | { portail: 'agent'; etat: 'resetsent' }
  | { portail: 'agent'; etat: 'setNewPassword' }

export function AuthBentoApp({
  route,
}: {
  route: AuthRoute
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const auth = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => resolveInitialTheme())
  const tokens = useMemo(() => bentoTokens(theme === 'dark'), [theme])
  const isMobile = useIsMobile()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const onThemeChange = (next: 'light' | 'dark') => {
    setTheme(next)
    writeThemeCookie(next)
  }

  const currentEmail = params.get('email') ?? undefined

  const switchPortal = (to: Portail) => {
    if (to === route.portail) return
    navigate(to === 'agent' ? '/auth/login?pro' : '/auth/login', {
      replace: true,
    })
  }

  // ─── Supabase handlers ────────────────────────────────────────────
  //
  // ⚠ Seuls `onSetNewPassword` et `onBackToSignIn` sont encore atteignables :
  // depuis le pivot CRM-first, la seule route vivante montant cet écran est
  // /auth/forgot-password/reset ; toutes les autres redirigent vers la vitrine
  // (VitrineLoginRedirect dans App.tsx), qui porte le vrai formulaire d'auth.
  // Les handlers restants n'envoient donc PLUS de token captcha — Supabase Auth
  // exigeant un captcha, les réactiver tels quels échouerait en `captcha_failed`.
  // Toute résurrection d'un écran d'auth in-app doit d'abord se doter d'un
  // captcha (voir sites/megga-vitrine/js/megga-auth.js pour l'implémentation
  // vivante, et son piège : les callbacks Turnstile sont figés au render()).

  const handlers: AuthHandlers = {
    onMagicLink: async (email) => {
      const { error } = await auth.signInWithEmail(email)
      if (error) {
        await logAuthEvent('magic_link.failure', { detail: error })
        navigate(`/auth/login/error?reason=${encodeURIComponent('rate_limited')}`, {
          replace: true,
        })
        return
      }
      await logAuthEvent('magic_link.sent')
      navigate(`/auth/login/link-sent?email=${encodeURIComponent(email)}`, {
        replace: true,
      })
    },
    onResend: async () => {
      if (!currentEmail) return
      const { error } = await auth.signInWithEmail(currentEmail)
      await logAuthEvent(error ? 'magic_link.failure' : 'magic_link.sent', {
        detail: error ?? 'resend',
      })
    },
    onChangeEmail: () => navigate('/auth/login', { replace: true }),
    onRetry: async () => {
      if (!currentEmail) {
        navigate('/auth/login', { replace: true })
        return
      }
      const { error } = await auth.signInWithEmail(currentEmail)
      await logAuthEvent(error ? 'magic_link.failure' : 'magic_link.sent', {
        detail: error ?? 'retry',
      })
      navigate(`/auth/login/link-sent?email=${encodeURIComponent(currentEmail)}`, {
        replace: true,
      })
    },
    onSignin: async (email, password) => {
      const { error } = await auth.signInWithPassword(email, password)
      if (error) {
        await logAuthEvent('signin.failure', { detail: error })
        return { ok: false }
      }
      await logAuthEvent('signin.success')
      return { ok: true }
    },
    onSignup: async ({ name, email, password }) => {
      const { error } = await auth.signUp(email, password, name.trim(), 'agent')
      if (error) {
        await logAuthEvent('signup.failure', { detail: error })
        return
      }
      await logAuthEvent('signup.created')
      navigate(
        `/auth/signup/verify-email?email=${encodeURIComponent(email)}`,
        { replace: true },
      )
    },
    onResendVerification: async (email) => {
      const { error } = await auth.signInWithEmail(email)
      await logAuthEvent(error ? 'magic_link.failure' : 'magic_link.sent', {
        detail: error ?? 'resend-verification',
      })
    },
    onBackToSignup: () => navigate('/auth/signup', { replace: true }),
    onResetRequest: async (email) => {
      const { error } = await auth.resetPassword(email)
      await logAuthEvent(
        error ? 'password.reset_failure' : 'password.reset_requested',
        { detail: error ?? undefined },
      )
      navigate(`/auth/forgot-password/sent?email=${encodeURIComponent(email)}`, {
        replace: true,
      })
    },
    onSetNewPassword: async (password) => {
      const { error } = await auth.updatePassword(password)
      if (error) {
        await logAuthEvent('password.reset_failure', { detail: error })
        return { ok: false, message: error }
      }
      await logAuthEvent('password.reset_confirmed')
      return { ok: true }
    },
    onOAuth: async (provider) => {
      const { error } =
        provider === 'google'
          ? await auth.signInWithGoogle('agent')
          : await auth.signInWithMicrosoft('agent')
      // Le succès OAuth se mesure côté /auth/callback ; ici on logge juste
      // l'init et un éventuel échec immédiat.
      if (error) {
        await logAuthEvent('oauth.signin.failure', { detail: `${provider}: ${error}` })
      }
    },
    onForgotPassword: () =>
      navigate('/auth/forgot-password', { replace: true }),
    onGoSignUp: () => navigate('/auth/signup', { replace: true }),
    onGoSignIn: () => navigate('/auth/login?pro', { replace: true }),
    onBackToSignIn: () => navigate('/auth/login?pro', { replace: true }),
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.canvasBg,
        fontFamily: tokens.font,
        letterSpacing: tokens.letterSpacing,
        color: tokens.titleColor,
        overflow: 'auto',
        transition: 'var(--bento-tx)',
      }}
    >
      <style>{BENTO_GLOBAL_CSS}</style>

      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '16px 20px' : '24px 40px',
          zIndex: 10,
          gap: 8,
        }}
      >
        <BentoLogoGG
          tokens={tokens}
          width={isMobile ? 48 : 62}
          height={isMobile ? 30 : 38}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 12,
          }}
        >
          <BentoThemeToggle
            tokens={tokens}
            dark={theme === 'dark'}
            onChange={onThemeChange}
          />
          <BentoPortalToggle
            tokens={tokens}
            portail={route.portail}
            onChange={switchPortal}
            size={isMobile ? 'sm' : 'lg'}
          />
        </div>
      </div>

      {/* Centered form card */}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '88px 16px 40px' : '120px 40px 60px',
        }}
      >
        <div
          style={{
            width: isMobile ? 'calc(100vw - 32px)' : '100%',
            maxWidth: 460,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', position: 'relative' }}>
            {/* AnimatePresence wrappe la form card : à chaque switch portail
                ou etat, l'ancienne sort en fade-down (0.22s), la nouvelle
                entre en fade-up (0.36s). mode="wait" évite le chevauchement. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${route.portail}-${route.etat}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{
                  duration: 0.36,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ width: '100%' }}
              >
                <BentoFormCard
                  tokens={tokens}
                  portail={route.portail}
                  etat={route.etat as AuthState}
                  handlers={handlers}
                  currentEmail={currentEmail}
                  compact={isMobile}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
