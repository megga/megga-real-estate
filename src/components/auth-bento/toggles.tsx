// MEGGA Auth — Toggles (Portal "duo" + Theme sun/moon)
// Source : handoff-auth/auth/megga-auth-bento.jsx → BentoToggleDuo + BentoThemeToggle
import { useState, type MouseEvent } from 'react'
import type { BentoTokens } from './tokens'

export type Portail = 'particulier' | 'agent'

const OPTIONS: Array<{ value: Portail; label: string }> = [
  { value: 'particulier', label: 'Privé' },
  { value: 'agent', label: 'Pro' },
]

export function BentoPortalToggle({
  tokens, portail, onChange, size = 'lg',
}: {
  tokens: BentoTokens
  portail: Portail
  onChange: (v: Portail) => void
  size?: 'lg' | 'sm'
}) {
  const HEIGHT = size === 'sm' ? 44 : 52
  const CIRCLE = size === 'sm' ? 34 : 40
  const PAD_X = size === 'sm' ? 16 : 24
  const PAD_LEFT_ACTIVE = size === 'sm' ? 16 : 22
  const handleHover = (active: boolean, e: MouseEvent<HTMLButtonElement>) => {
    if (active) return
    const el = e.currentTarget
    el.style.boxShadow = `0 0 0 1px ${tokens.inkColor} inset`
    el.style.color = tokens.titleColor
  }
  const handleLeave = (active: boolean, e: MouseEvent<HTMLButtonElement>) => {
    if (active) return
    const el = e.currentTarget
    el.style.boxShadow = `0 0 0 1px ${tokens.inputBorder} inset`
    el.style.color = tokens.bodyColor
  }
  return (
    <div style={{ display: 'inline-flex', gap: 8, fontFamily: tokens.font }}>
      {OPTIONS.map((o) => {
        const active = portail === o.value
        if (active) {
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: HEIGHT,
                paddingLeft: PAD_LEFT_ACTIVE,
                paddingRight: 6,
                background: tokens.inkColor,
                border: 0,
                borderRadius: 200,
                color: tokens.ctaFg,
                fontFamily: tokens.font,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: tokens.letterSpacing,
                cursor: 'default',
                gap: 14,
              }}
            >
              <span>{o.label}</span>
              <span
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: 999,
                  background: tokens.ctaCircleBg,
                  color: tokens.ctaCircleFg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              </span>
            </button>
          )
        }
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            onMouseEnter={(e) => handleHover(false, e)}
            onMouseLeave={(e) => handleLeave(false, e)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: HEIGHT,
              padding: `0 ${PAD_X}px`,
              background: 'transparent',
              border: 0,
              borderRadius: 200,
              boxShadow: `0 0 0 1px ${tokens.inputBorder} inset`,
              color: tokens.bodyColor,
              fontFamily: tokens.font,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: tokens.letterSpacing,
              cursor: 'pointer',
              transition: 'all 0.18s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Theme toggle (sun/moon crossfade) ───────────────────────────────

const SunIcon = (
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
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>
)
const MoonIcon = (
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
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export function BentoThemeToggle({
  tokens, dark, onChange,
}: {
  tokens: BentoTokens
  dark: boolean
  onChange: (theme: 'light' | 'dark') => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onChange(dark ? 'light' : 'dark')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? tokens.cardBg : tokens.subtleBg,
        border: 0,
        borderRadius: 999,
        boxShadow: `0 0 0 1px ${tokens.inputBorder} inset`,
        color: tokens.titleColor,
        cursor: 'pointer',
        transition: 'all 0.18s',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dark ? 0 : 1,
          transform: dark ? 'rotate(-30deg) scale(0.8)' : 'rotate(0) scale(1)',
          transition: 'opacity 0.25s, transform 0.25s',
        }}
      >
        {MoonIcon}
      </span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dark ? 1 : 0,
          transform: dark ? 'rotate(0) scale(1)' : 'rotate(30deg) scale(0.8)',
          transition: 'opacity 0.25s, transform 0.25s',
        }}
      >
        {SunIcon}
      </span>
    </button>
  )
}
