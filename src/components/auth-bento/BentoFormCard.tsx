// MEGGA Auth — Form card + 7 states (signin/signup/reset/resetsent · initial/sent/error)
// Source : handoff-auth/auth/megga-auth-bento.jsx → BentoFormCard + renderFormFields
import { useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ERROR_COLOR, type BentoTokens } from './tokens'
import {
  BentoCTA,
  BentoInput,
  BentoLogoWordmark,
  BentoOAuth,
} from './primitives'
import {
  AlertIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  MicrosoftIcon,
  UserIcon,
} from './primitiveIcons'
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
  onSignup?: (data: { name: string; email: string; password: string }) => Promise<void> | void
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

// Titles are sourced from i18n via `t('titles.<state>')` — see fr/auth.json.

function Divider({ tokens }: { tokens: BentoTokens }) {
  const { t } = useTranslation('auth')
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
        transition: 'var(--bento-tx)',
      }}
    >
      <div style={{ flex: 1, height: 1, background: tokens.ghostColor, opacity: 0.45, transition: 'var(--bento-tx)' }} />
      <span>{t('divider')}</span>
      <div style={{ flex: 1, height: 1, background: tokens.ghostColor, opacity: 0.45, transition: 'var(--bento-tx)' }} />
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
  const { t } = useTranslation('auth')
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
      {PASSWORD_RULE_LABELS.map(({ key }) => {
        const ok = rules[key]
        const label = t(`passwordRules.${key}`)
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
              transition: 'var(--bento-tx), color 0.18s ease',
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
                transition: 'var(--bento-tx), background 0.18s ease, box-shadow 0.18s ease',
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
        transition: 'var(--bento-tx)',
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
  const { t } = useTranslation('auth')
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
        // L'animation d'entrée est gérée par AnimatePresence dans le shell
        // (motion.div parent). On garde uniquement la transition theme.
        transition: 'var(--bento-tx)',
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
          transition: 'var(--bento-tx)',
        }}
      >
        {t(`titles.${etat}`)}
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
  const { t } = useTranslation('auth')
  const [email, setEmailRaw] = useState(currentEmail ?? '')
  const [password, setPasswordRaw] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
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
          placeholder={t('fields.emailParticulier')}
          leftIcon={MailIcon}
          autoFocus
        />
        <BentoCTA
          tokens={tokens}
          label={t('ctas.magicLink')}
          loadingLabel={t('ctas.magicLinkLoading')}
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
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
          <Trans
            i18nKey="body.linkSentTo"
            ns="auth"
            values={{ email: currentEmail ?? email }}
            components={{ strong: <strong style={{ color: tokens.titleColor }} /> }}
          />
        </div>
        <BentoCTA
          tokens={tokens}
          label={t('ctas.resend')}
          loadingLabel={t('ctas.resendLoading')}
          loading={submitting}
          cooldownSeconds={magicCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResend?.()
            magicCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onChangeEmail?.()}>
          {t('footer.changeEmail')}
        </FooterLink>
      </>
    )
  }

  // ─── Particulier — error (rate limited) ──────────────────────────
  if (portail === 'particulier' && etat === 'error') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
          {t('body.rateLimited')}
        </div>
        <BentoCTA
          tokens={tokens}
          label={t('ctas.retry')}
          loadingLabel={t('ctas.retryLoading')}
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
          label={t('ctas.google')}
          onClick={() => handlers.onOAuth?.('google')}
        />
        <BentoOAuth
          tokens={tokens}
          icon={MicrosoftIcon}
          label={t('ctas.microsoft')}
          onClick={() => handlers.onOAuth?.('microsoft')}
        />
        <Divider tokens={tokens} />
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t('fields.emailAgent')}
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
          placeholder={t('fields.password')}
          leftIcon={LockIcon}
          error={signinError}
          shakeKey={shakeKey}
        />
        <BentoCTA
          tokens={tokens}
          label={t('ctas.signin')}
          loadingLabel={t('ctas.signinLoading')}
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
            <span>{t('errors.signinFailed')}</span>
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
            {t('footer.forgotPassword')}
          </FooterLink>
          <FooterLink tokens={tokens} onClick={() => handlers.onGoSignUp?.()}>
            {t('footer.createAccount')}
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
          label={t('ctas.google')}
          onClick={() => handlers.onOAuth?.('google')}
        />
        <BentoOAuth
          tokens={tokens}
          icon={MicrosoftIcon}
          label={t('ctas.microsoft')}
          onClick={() => handlers.onOAuth?.('microsoft')}
        />
        <Divider tokens={tokens} />
        <BentoInput
          tokens={tokens}
          type="text"
          value={name}
          onChange={setName}
          placeholder={t('fields.fullName')}
          leftIcon={UserIcon}
          autoFocus
        />
        <BentoInput
          tokens={tokens}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t('fields.emailAgent')}
          leftIcon={MailIcon}
        />
        <BentoInput
          tokens={tokens}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={t('fields.password')}
          leftIcon={LockIcon}
        />
        <PasswordChecklist
          tokens={tokens}
          password={password}
          visible={password.length > 0}
        />
        <BentoCTA
          tokens={tokens}
          label={t('ctas.signup')}
          loadingLabel={t('ctas.signupLoading')}
          loading={submitting}
          disabled={!passwordIsValid(password) || !name.trim() || !email.trim()}
          onClick={withLoading(() =>
            handlers.onSignup?.({ name, email, password }),
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
          {t('footer.alreadyAccount')}{' '}
          <FooterLink tokens={tokens} onClick={() => handlers.onGoSignIn?.()}>
            {t('footer.signIn')}
          </FooterLink>
        </div>
      </>
    )
  }

  // ─── Agent — verifyEmail (after signup) ─────────────────────────
  if (portail === 'agent' && etat === 'verifyEmail') {
    return (
      <>
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
          <Trans
            i18nKey="body.verifyEmailIntro"
            ns="auth"
            values={{ email: currentEmail ?? email }}
            components={{ strong: <strong style={{ color: tokens.titleColor }} /> }}
          />
        </div>
        <BentoCTA
          tokens={tokens}
          label={t('ctas.resend')}
          loadingLabel={t('ctas.resendLoading')}
          loading={submitting}
          cooldownSeconds={verifyCooldown.remaining}
          onClick={withLoading(async () => {
            if (currentEmail) await handlers.onResendVerification?.(currentEmail)
            verifyCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignup?.()}>
          {t('footer.backToSignup')}
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
          placeholder={t('fields.emailAgent')}
          leftIcon={MailIcon}
          autoFocus
        />
        <BentoCTA
          tokens={tokens}
          label={t('ctas.resetRequest')}
          loadingLabel={t('ctas.resendLoading')}
          loading={submitting}
          cooldownSeconds={resetCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResetRequest?.(email)
            resetCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignIn?.()}>
          {t('footer.backToSignIn')}
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
            <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
              {t('body.passwordUpdated')}
            </div>
            <BentoCTA
              tokens={tokens}
              label={t('ctas.goToCrm')}
              onClick={() => handlers.onBackToSignIn?.()}
            />
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
              {t('body.setNewPasswordIntro')}
            </div>
            <BentoInput
              tokens={tokens}
              type="password"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setSetNewPasswordError(null)
              }}
              placeholder={t('fields.newPassword')}
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
              placeholder={t('fields.confirmPassword')}
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
                <span>{t('errors.passwordsMismatch')}</span>
              </div>
            )}
            <BentoCTA
              tokens={tokens}
              label={t('ctas.setNewPassword')}
              loadingLabel={t('ctas.setNewPasswordLoading')}
              loading={submitting}
              disabled={!canSubmit}
              onClick={async () => {
                if (submitting || !canSubmit) return
                setSubmitting(true)
                setSetNewPasswordError(null)
                try {
                  const res = await handlers.onSetNewPassword?.(password)
                  if (res && !res.ok) {
                    setSetNewPasswordError(res.message ?? t('errors.updateFailed'))
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
        <div style={{ fontSize: 14, color: tokens.bodyColor, lineHeight: 1.5, transition: 'var(--bento-tx)' }}>
          <Trans
            i18nKey="body.resetSentTo"
            ns="auth"
            values={{ email: currentEmail ?? email }}
            components={{ strong: <strong style={{ color: tokens.titleColor }} /> }}
          />
        </div>
        <BentoCTA
          tokens={tokens}
          label={t('ctas.resend')}
          loadingLabel={t('ctas.resendLoading')}
          loading={submitting}
          cooldownSeconds={resetCooldown.remaining}
          onClick={withLoading(async () => {
            await handlers.onResend?.()
            resetCooldown.start()
          })}
        />
        <FooterLink tokens={tokens} onClick={() => handlers.onBackToSignIn?.()}>
          {t('footer.backToSignIn')}
        </FooterLink>
      </>
    )
  }

  return null
}
