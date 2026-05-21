// MEGGA Auth — Primitives Bento (Input, CTA, OAuth, Logos)
// Source : handoff-auth/auth/megga-auth-bento.jsx
import { useState, type ReactNode } from 'react'
import { ERROR_COLOR, type BentoTokens } from './tokens'

// ─── Icons used by inputs ─────────────────────────────────────────────

const EyeIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOffIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

// ─── BentoInput ──────────────────────────────────────────────────────

export function BentoInput({
  tokens,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
  leftIcon,
  error,
  shakeKey,
}: {
  tokens: BentoTokens
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  leftIcon?: ReactNode
  error?: boolean
  shakeKey?: number
}) {
  const [focus, setFocus] = useState(false)
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const effectiveType = isPassword && reveal ? 'text' : type

  return (
    <div
      key={shakeKey /* re-mount → replay shake animation */}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        background: focus ? tokens.cardBg : tokens.subtleBg,
        borderRadius: 200,
        height: 50,
        transition: 'all 0.18s',
        boxShadow: error
          ? `0 0 0 2px ${ERROR_COLOR} inset`
          : focus
            ? `0 0 0 1px ${tokens.inkColor} inset`
            : `0 0 0 1px ${tokens.inputBorder} inset`,
        animation: error
          ? 'megga-auth-shake 0.5s cubic-bezier(.36,.07,.19,.97)'
          : 'none',
      }}
    >
      {leftIcon && (
        <div
          style={{
            flexShrink: 0,
            color: error ? ERROR_COLOR : tokens.mutedColor,
            display: 'flex',
          }}
        >
          {leftIcon}
        </div>
      )}
      <input
        type={effectiveType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          border: 0,
          outline: 'none',
          background: 'transparent',
          fontFamily: tokens.font,
          fontSize: 14,
          fontWeight: 500,
          color: tokens.titleColor,
          letterSpacing: tokens.letterSpacing,
          padding: 0,
        }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={
            reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 0,
            padding: 0,
            borderRadius: 999,
            color: reveal ? tokens.inkColor : tokens.mutedColor,
            cursor: 'pointer',
            transition: 'color 0.15s, background 0.15s',
            marginRight: -8,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = tokens.inkColor
            ;(e.currentTarget as HTMLButtonElement).style.background =
              tokens.subtleBg
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = reveal
              ? tokens.inkColor
              : tokens.mutedColor
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'transparent'
          }}
        >
          {reveal ? EyeOffIcon : EyeIcon}
        </button>
      )}
    </div>
  )
}

// ─── BentoCTA (asymmetric pill + inverse circle) ─────────────────────

const ArrowIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)
const SpinnerIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    style={{ animation: 'megga-auth-spin 0.7s linear infinite' }}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

export function BentoCTA({
  tokens,
  label,
  loadingLabel,
  cooldownSeconds,
  onClick,
  loading,
  disabled,
  type,
}: {
  tokens: BentoTokens
  label: string
  loadingLabel?: string
  /** Si > 0, le CTA est désactivé et affiche "Renvoyer (XXs)". */
  cooldownSeconds?: number
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const [hover, setHover] = useState(false)
  const inCooldown = (cooldownSeconds ?? 0) > 0
  const effectiveLabel = inCooldown
    ? `${label} (${cooldownSeconds}s)`
    : loading && loadingLabel
      ? loadingLabel
      : label
  const isBusy = disabled || loading || inCooldown
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={isBusy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 52,
        background: hover && !isBusy ? tokens.ctaBgHover : tokens.ctaBg,
        color: tokens.ctaFg,
        border: 0,
        borderRadius: 200,
        fontFamily: tokens.font,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: tokens.letterSpacing,
        cursor: isBusy ? 'not-allowed' : 'pointer',
        opacity: disabled || inCooldown ? 0.55 : 1,
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 22,
        paddingRight: 6,
        gap: 8,
      }}
    >
      <span
        style={{
          flex: 1,
          textAlign: 'left',
          opacity: loading ? 0.72 : 1,
          transition: 'opacity 0.22s',
        }}
      >
        {effectiveLabel}
      </span>
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: tokens.ctaCircleBg,
          color: tokens.ctaCircleFg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: hover && !isBusy ? 'translateX(2px)' : 'none',
          transition: 'transform 0.18s',
        }}
      >
        {loading ? SpinnerIcon : ArrowIcon}
      </span>
    </button>
  )
}

// ─── BentoOAuth (ghost pill with provider icon) ──────────────────────

export function BentoOAuth({
  tokens,
  label,
  icon,
  onClick,
  disabled,
}: {
  tokens: BentoTokens
  label: string
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 48,
        background: hover ? tokens.subtleBg : tokens.cardBg,
        color: tokens.titleColor,
        border: 0,
        borderRadius: 200,
        boxShadow: `0 0 0 1px ${hover ? tokens.inkColor : tokens.inputBorder} inset`,
        fontFamily: tokens.font,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: tokens.letterSpacing,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ─── Provider icons ──────────────────────────────────────────────────

export const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

export const MicrosoftIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <rect width="10" height="10" fill="#F25022" />
    <rect x="12" width="10" height="10" fill="#7FBA00" />
    <rect y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
)

// ─── Logos (gg monogram + wordmark) ──────────────────────────────────

export function BentoLogoGG({
  tokens,
  width = 62,
  height = 38,
}: {
  tokens: BentoTokens
  width?: number
  height?: number
}) {
  return (
    <img
      src="/megga-gg.svg"
      alt="MEGGA"
      style={{
        width,
        height,
        display: 'block',
        color: tokens.titleColor,
        filter: tokens.logoInvert ? 'invert(1)' : 'none',
      }}
    />
  )
}

export function BentoLogoWordmark({
  tokens,
  height = 22,
}: {
  tokens: BentoTokens
  height?: number
}) {
  return (
    <img
      src="/megga-wordmark.svg"
      alt="MEGGA"
      style={{
        height,
        width: 'auto',
        display: 'block',
        color: tokens.titleColor,
        filter: tokens.logoInvert ? 'invert(1)' : 'none',
      }}
    />
  )
}

// ─── Form input icons (used by states) ───────────────────────────────

export const MailIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)
export const LockIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
export const UserIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
export const BuildingIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="9" y1="6" x2="9" y2="6" />
    <line x1="15" y1="6" x2="15" y2="6" />
    <line x1="9" y1="10" x2="9" y2="10" />
    <line x1="15" y1="10" x2="15" y2="10" />
    <line x1="9" y1="14" x2="9" y2="14" />
    <line x1="15" y1="14" x2="15" y2="14" />
  </svg>
)
export const AlertIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)
