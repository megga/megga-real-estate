// MEGGA Auth — Form card + 7 states (signin/signup/reset/resetsent · initial/sent/error)
// Source : handoff-auth/auth/megga-auth-bento.jsx → BentoFormCard + renderFormFields
import { useState, type ReactNode } from 'react'
import { ERROR_COLOR, type BentoTokens } from './tokens'
import {
  AlertIcon,
  BentoCTA,
  BentoInput,
  BentoLogoWordmark,
  BentoOAuth,
  BuildingIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  MicrosoftIcon,
  UserIcon,
} from './primitives'
import type { Portail } from './toggles'
import { useCooldown } from './useCooldown'
import {
  PASSWORD_RULE_LABELS,
  passwordIsValid,
  validatePassword,
} from './passwordRules'

export type AuthState =
  | 'initial'
  | 'sent'
  | 'error'
  | 'signin'
  | 'signup'
  | 'verifyEmail'
  | 'reset'
  | 'resetsent'
  | 'setNewPassword'

export type AuthHandlers = {
  onMagicLink?: (email: string) => Promise<void> | void
  onResend?: () => Promise<void> | void
  onChangeEmail?: () => void
  onRetry?: () => Promise<void> | void
  onSignin?: (email: string, password: string) => Promise<{ ok: boolean }> | { ok: boolean }
  onSignup?: (data: { name: string; agency: string; email: string; password: string }) => Promise<void> | void
  onResendVerification?: (email: string) => Promise<void> | void
  onBackToSignup?: () => void
  onResetRequest?: (email: string) => Promise<void> | void
  onSetNewPassword?: (password: string) => Promise<{ ok: boolean; message?: string }> | { ok: boolean; message?: string }
  onOAuth?: (provider: 'google' | 'microsoft') => Promise<void> | void
  onForgotPassword?: () => void
  onGoSignUp?: () => void
  onGoSignIn?: () => void
  onBackToSignIn?: () => void
}

const TITLES: Record<AuthState, string> = {
  initial: 'Bienvenue.',
  sent: 'Lien envoyé.',
  error: 'Trop de tentatives.',
  signin: 'Bon retour.',
  signup: 'Rejoignez MEGGA.',
  verifyEmail: 'Vérifiez votre email.',
  reset: 'Mot de passe oublié.',
  resetsent: 'Email envoyé.',
  setNewPassword: 'Nouveau mot de passe.',
}

function Divider({ tokens }: { tokens: BentoTokens }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: tokens.mutedColor,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      <div style={{ flex: 1, height: 1, background: tokens.ghostColor, opacity: 0.45 }} />
      <span>ou</span>
      <div style={{ flex: 1, height: 1, background: tokens.ghostColor, opacity: 0.45 }} />
    </div>
  )
}

function PasswordChecklist({
  tokens, password, visible,
}: {
  tokens: BentoTokens
  password: string
  visible: boolean
}) {
  if (!visible) return null
  const rules = validatePassword(password)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px 16px',
        marginTop: -10,
        padding: '4px 4px 0',
        fontFamily: tokens.font,
        letterSpacing: tokens.letterSpacing,
      }}
    >
      {PASSWORD_RULE_LABELS.map(({ key, label }) => {
        const ok = rules[key]
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 500,
              color: ok ? tokens.titleColor : tokens.mutedColor,
              transition: 'color 0.18s',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 14,
                height: 14,
                borderRadius: 999,
                background: ok ? tokens.inkColor : 'transparent',
                boxShadow: ok ? 'none' : `0 0 0 1px ${tokens.inputBorder} inset`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.ctaFg,
                transition: 'all 0.18s',
              }}
            >
              {ok && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              )}
            </span>
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function FooterLink({
  tokens, children, onClick,
}: {
  tokens: BentoTokens
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        padding: 0,
        color: tokens.titleColor,
        fontWeight: 500,
        fontFamily: tokens.font,
        fontSize: 13,
        letterSpacing: tokens.letterSpacing,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export function BentoFormCard({
  tokens, portail, etat, handlers, currentEmail, compact,
}: {
  tokens: BentoTokens
  portail: Portail
  etat: AuthState
  handlers: AuthHandlers
  currentEmail?: string
  compact?: boolean
}) {
  return (
    <div
      style={{
        background: tokens.cardBg,
        borderRadius: compact ? 22 : 28,
        border: tokens.cardBorder,
        boxShadow: tokens.cardShadow,
        padding: compact ? '28px 24px 24px' : '36px 36px 32px',
        fontFamily: tokens.font,
        letterSpacing: tokens.letterSpacing,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        animation: 'megga-auth-fade-up 0.4s cubic-bezier(.22,1,.36,1) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BentoLogoWordmark tokens={tokens} height={22} />
      </div>

      <h1
        style={{
          margin: 0,
          fontFamily: tokens.font,
          fontSize: 36,
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: tokens.titleLetterSpacing,
          color: tokens.titleColor,
        }}
      >
        {TITLES[etat]}
      </h1>

      <FormFields
        tokens={tokens}
        portail={portail}
        etat={etat}
        handlers={handlers}
        currentEmail={currentEmail}
      />
    </div>
  )
}

function FormFields({
  tokens, portail, etat, handlers, currentEmail,
}: {
  tokens: BentoTokens
  portail: Portail
  etat: AuthState
  handlers: AuthHandlers
  currentEmail?: string
}) {
  const [email, setEmailRaw] = useState(currentEmail ?? '')
  const [password, setPasswordRaw] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [agency, setAgency] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signinError, setSigninError] = useState(false)
  const [setNewPasswordError, setSetNewPasswordError] = useState<string | null>(null)
  const [setNewPasswordDone, setSetNewPasswordDone] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  // Cooldowns rate-limit côté UX (60s entre 2 envois).
  // Persistés via sessionStorage → survivent à la navigation
  // initial → sent (et reset → resetsent).
  const magicCooldown = useCooldown('magic-link', 60)
  const resetCooldown = useCooldown('reset-request', 60)
  const verifyCooldown = useCooldown('verify-email', 60)

  const setEmail = (v: string) => {
    setEmailRaw(v)
    if (signinError) setSigninError(false)
  }
  const setPassword = (v: string) => {
    setPasswordRaw(v)
    if (signinError) setSigninError(false)
  }

  const withLoading = <T extends unknown[]>(fn?: (...args: T) => Promise<unknown> | unknown) =>
    async (...args: T) => {
      if (submitting) return
      setSubmitting(true)
      try {
        if (fn) await fn(...args)
      } finally {
        setSubmitting(false)
      }
    }

  const handleAgentSignin = async () => {
    if (submitting) return
    setSubmitting(true)
    setSigninError(false)
    try {
      const res = await handlers.onSignin?.(email, password)
      if (res && !res.ok) {
        setSigninError(true)
        setShakeKey((k) => k + 1)
      }
    } catch {
      setSigninError(true)
      setShakeKey((k) => k + 1)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Particulier — initial ───────────────────────────────────────
  if (portail === 'particulier' && etat === 'initial') {
    return (
      <>
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="votre@email.ch"
          leftIcon={MailIcon}
          autoFocus
        />
        <BentoCTA
          tokens={tokens}
          label="Recevoir un lien magique"
          loadingLabel="Envoi en cours…"
          loading={submitting}
          cooldownSeconds={magicCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onMagicLink?.(email)
            magicCooldown.start()
          })}
        />
      </>
    )
  }

  // ─── Particulier — sent ──────────────────────────────────────────
  if (portail === 'particulier' && etat === 'sent') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
          Lien envoyé à{' '}
          <strong style={{ color: tokens.titleColor }}>{currentEmail ?? email}</strong>. Vérifiez votre boîte mail.
        </div>
        <BentoCTA
          tokens={tokens}
          label="Renvoyer le lien"
          loadingLabel="Envoi en cours…"
          loading={submitting}
          cooldownSeconds={magicCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResend?.()
            magicCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onChangeEmail?.()}>
          ← Changer d'email
        </FooterLink>
      </>
    )
  }

  // ─── Particulier — error (rate limited) ──────────────────────────
  if (portail === 'particulier' && etat === 'error') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
          Vous avez demandé trop de liens. Réessayez dans quelques minutes.
        </div>
        <BentoCTA
          tokens={tokens}
          label="Réessayer"
          loadingLabel="Patientez…"
          loading={submitting}
          onClick={withLoading(() => handlers.onRetry?.())}
        />
      </>
    )
  }

  // ─── Agent — signin ──────────────────────────────────────────────
  if (portail === 'agent' && etat === 'signin') {
    return (
      <>
        <BentoOAuth
          tokens={tokens}
          icon={GoogleIcon}
          label="Continuer avec Google"
          onClick={() => handlers.onOAuth?.('google')}
        />
        <BentoOAuth
          tokens={tokens}
          icon={MicrosoftIcon}
          label="Continuer avec Microsoft"
          onClick={() => handlers.onOAuth?.('microsoft')}
        />
        <Divider tokens={tokens} />
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="email@agence.ch"
          leftIcon={MailIcon}
          autoFocus
          error={signinError}
          shakeKey={shakeKey}
        />
        <BentoInput
          tokens={tokens}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Mot de passe"
          leftIcon={LockIcon}
          error={signinError}
          shakeKey={shakeKey}
        />
        <BentoCTA
          tokens={tokens}
          label="Se connecter"
          loadingLabel="Connexion…"
          loading={submitting}
          onClick={handleAgentSignin}
        />
        {signinError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: -10,
              fontSize: 13,
              fontWeight: 500,
              color: ERROR_COLOR,
              letterSpacing: tokens.letterSpacing,
              fontFamily: tokens.font,
            }}
          >
            {AlertIcon}
            <span>Email ou mot de passe incorrect.</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: tokens.bodyColor,
            fontFamily: tokens.font,
            letterSpacing: tokens.letterSpacing,
            marginTop: -4,
          }}
        >
          <FooterLink tokens={tokens} onClick={() => handlers.onForgotPassword?.()}>
            Mot de passe oublié
          </FooterLink>
          <FooterLink tokens={tokens} onClick={() => handlers.onGoSignUp?.()}>
            Créer un compte
          </FooterLink>
        </div>
      </>
    )
  }

  // ─── Agent — signup ──────────────────────────────────────────────
  if (portail === 'agent' && etat === 'signup') {
    return (
      <>
        <BentoOAuth
          tokens={tokens}
          icon={GoogleIcon}
          label="Continuer avec Google"
          onClick={() => handlers.onOAuth?.('google')}
        />
        <BentoOAuth
          tokens={tokens}
          icon={MicrosoftIcon}
          label="Continuer avec Microsoft"
          onClick={() => handlers.onOAuth?.('microsoft')}
        />
        <Divider tokens={tokens} />
        <BentoInput
          tokens={tokens}
          type="text"
          value={name}
          onChange={setName}
          placeholder="Nom complet"
          leftIcon={UserIcon}
          autoFocus
        />
        <BentoInput
          tokens={tokens}
          type="text"
          value={agency}
          onChange={setAgency}
          placeholder="Nom de l'agence"
          leftIcon={BuildingIcon}
        />
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="email@agence.ch"
          leftIcon={MailIcon}
        />
        <BentoInput
          tokens={tokens}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Mot de passe"
          leftIcon={LockIcon}
        />
        <PasswordChecklist
          tokens={tokens}
          password={password}
          visible={password.length > 0}
        />
        <BentoCTA
          tokens={tokens}
          label="Créer mon espace"
          loadingLabel="Création en cours…"
          loading={submitting}
          disabled={!passwordIsValid(password) || !name.trim() || !agency.trim() || !email.trim()}
          onClick={withLoading(() =>
            handlers.onSignup?.({ name, agency, email, password }),
          )}
        />
        <div
          style={{
            fontSize: 13,
            color: tokens.bodyColor,
            fontFamily: tokens.font,
            letterSpacing: tokens.letterSpacing,
            textAlign: 'center',
            marginTop: -4,
          }}
        >
          Déjà un compte ?{' '}
          <FooterLink tokens={tokens} onClick={() => handlers.onGoSignIn?.()}>
            Se connecter
          </FooterLink>
        </div>
      </>
    )
  }

  // ─── Agent — verifyEmail (after signup) ─────────────────────────
  if (portail === 'agent' && etat === 'verifyEmail') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
          Un lien d'activation a été envoyé à{' '}
          <strong style={{ color: tokens.titleColor }}>{currentEmail ?? email}</strong>.
          Cliquez dessus pour activer votre compte et accéder à MEGGA.
        </div>
        <BentoCTA
          tokens={tokens}
          label="Renvoyer le lien"
          loadingLabel="Envoi en cours…"
          loading={submitting}
          cooldownSeconds={verifyCooldown.remaining}
          onClick={withLoading(async () => {
            if (currentEmail) await handlers.onResendVerification?.(currentEmail)
            verifyCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignup?.()}>
          ← Changer d'email
        </FooterLink>
      </>
    )
  }

  // ─── Agent — reset ──────────────────────────────────────────────
  if (portail === 'agent' && etat === 'reset') {
    return (
      <>
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="email@agence.ch"
          leftIcon={MailIcon}
          autoFocus
        />
        <BentoCTA
          tokens={tokens}
          label="Recevoir le lien"
          loadingLabel="Envoi en cours…"
          loading={submitting}
          cooldownSeconds={resetCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResetRequest?.(email)
            resetCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignIn?.()}>
          ← Retour à la connexion
        </FooterLink>
      </>
    )
  }

  // ─── Agent — setNewPassword (after clicking the reset email link) ─
  if (portail === 'agent' && etat === 'setNewPassword') {
    const passwordsMatch = password.length > 0 && password === confirmPassword
    const canSubmit = passwordIsValid(password) && passwordsMatch && !submitting
    return (
      <>
        {setNewPasswordDone ? (
          <>
            <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
              Votre mot de passe a été mis à jour. Vous pouvez maintenant accéder à MEGGA.
            </div>
            <BentoCTA
              tokens={tokens}
              label="Aller à MEGGA"
              onClick={() => handlers.onBackToSignIn?.()}
            />
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
              Choisissez un mot de passe d'au moins 12 caractères, avec une majuscule, un chiffre et un caractère spécial.
            </div>
            <BentoInput
              tokens={tokens}
              type="password"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setSetNewPasswordError(null)
              }}
              placeholder="Nouveau mot de passe"
              leftIcon={LockIcon}
              autoFocus
            />
            <PasswordChecklist
              tokens={tokens}
              password={password}
              visible={password.length > 0}
            />
            <BentoInput
              tokens={tokens}
              type="password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v)
                setSetNewPasswordError(null)
              }}
              placeholder="Confirmer le mot de passe"
              leftIcon={LockIcon}
              error={confirmPassword.length > 0 && !passwordsMatch}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: -10,
                  fontSize: 13,
                  fontWeight: 500,
                  color: ERROR_COLOR,
                  letterSpacing: tokens.letterSpacing,
                  fontFamily: tokens.font,
                }}
              >
                {AlertIcon}
                <span>Les deux mots de passe ne correspondent pas.</span>
              </div>
            )}
            <BentoCTA
              tokens={tokens}
              label="Définir le mot de passe"
              loadingLabel="Mise à jour…"
              loading={submitting}
              disabled={!canSubmit}
              onClick={async () => {
                if (submitting || !canSubmit) return
                setSubmitting(true)
                setSetNewPasswordError(null)
                try {
                  const res = await handlers.onSetNewPassword?.(password)
                  if (res && !res.ok) {
                    setSetNewPasswordError(res.message ?? 'Échec de la mise à jour.')
                    setShakeKey((k) => k + 1)
                  } else if (res?.ok) {
                    setSetNewPasswordDone(true)
                  }
                } finally {
                  setSubmitting(false)
                }
              }}
            />
            {setNewPasswordError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: -10,
                  fontSize: 13,
                  fontWeight: 500,
                  color: ERROR_COLOR,
                  letterSpacing: tokens.letterSpacing,
                  fontFamily: tokens.font,
                }}
              >
                {AlertIcon}
                <span>{setNewPasswordError}</span>
              </div>
            )}
          </>
        )}
      </>
    )
  }

  // ─── Agent — resetsent ──────────────────────────────────────────
  if (portail === 'agent' && etat === 'resetsent') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5 }}>
          Un lien de réinitialisation a été envoyé à{' '}
          <strong style={{ color: tokens.titleColor }}>{currentEmail ?? email}</strong>.
        </div>
        <BentoCTA
          tokens={tokens}
          label="Renvoyer le lien"
          loadingLabel="Envoi en cours…"
          loading={submitting}
          cooldownSeconds={resetCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResend?.()
            resetCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignIn?.()}>
          ← Retour à la connexion
        </FooterLink>
      </>
    )
  }

  return null
}
