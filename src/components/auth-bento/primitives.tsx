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
        transition: 'var(--bento-tx), box-shadow 0.18s ease',
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
            transition: 'var(--bento-tx), color 0.15s ease, background 0.15s ease',
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
        transition: 'var(--bento-tx), opacity 0.18s ease',
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
          transition: 'var(--bento-tx), transform 0.18s ease',
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
        transition: 'var(--bento-tx), opacity 0.18s ease',
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
        transition: 'var(--bento-tx)',
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
        transition: 'var(--bento-tx)',
      }}
    />
  )
}
