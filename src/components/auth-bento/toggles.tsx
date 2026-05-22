// MEGGA Auth — Toggles (Portal "duo" + Theme sun/moon)
// Source : handoff-auth/auth/megga-auth-bento.jsx → BentoToggleDuo + BentoThemeToggle
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BentoTokens } from './tokens'

export type Portail = 'particulier' | 'agent'

export function BentoPortalToggle({
  tokens, portail, onChange, size = 'lg',
}: {
  tokens: BentoTokens
  portail: Portail
  onChange: (v: Portail) => void
  size?: 'lg' | 'sm'
}) {
  const { t } = useTranslation('auth')
  const OPTIONS: Array<{ value: Portail; label: string }> = [
    { value: 'particulier', label: t('portails.particulier') },
    { value: 'agent', label: t('portails.agent') },
  ]
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const HEIGHT = size === 'sm' ? 44 : 52
  const CIRCLE = size === 'sm' ? 34 : 40
  const PAD_LEFT = size === 'sm' ? 16 : 22
  const PAD_RIGHT_ACTIVE = 6
  const PAD_RIGHT_INACTIVE = PAD_LEFT
  const GAP_ACTIVE = 14
  const TX = '0.36s cubic-bezier(.22,1,.36,1)'

  return (
    <div style={{ display: 'inline-flex', gap: 8, fontFamily: tokens.font }}>
      {OPTIONS.map((o, i) => {
        const active = portail === o.value
        const hovered = hoverIdx === i
        // Largeur stable : inactif et actif occupent le même espace (le cercle
        // ✓ reste dans le DOM avec width 0 quand inactif). Pas de layout shift.
        const ringColor = hovered && !active ? tokens.inkColor : tokens.inputBorder
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => !active && onChange(o.value)}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            aria-pressed={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: HEIGHT,
              paddingLeft: PAD_LEFT,
              paddingRight: active ? PAD_RIGHT_ACTIVE : PAD_RIGHT_INACTIVE,
              background: active ? tokens.inkColor : 'transparent',
              border: 0,
              borderRadius: 200,
              boxShadow: active ? 'none' : `0 0 0 1px ${ringColor} inset`,
              color: active ? tokens.ctaFg : hovered ? tokens.titleColor : tokens.bodyColor,
              fontFamily: tokens.font,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: tokens.letterSpacing,
              cursor: active ? 'default' : 'pointer',
              gap: GAP_ACTIVE,
              transition: `background ${TX}, color ${TX}, box-shadow ${TX}, padding-right ${TX}`,
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{o.label}</span>
            {/* Cercle ✓ inverse — toujours présent dans le DOM ; sa width
                (0 ↔ CIRCLE), opacity (0 ↔ 1) et scale (0.4 ↔ 1) morphent
                ensemble sur 0.36s cubic-bezier signature. */}
            <span
              aria-hidden
              style={{
                width: active ? CIRCLE : 0,
                height: CIRCLE,
                borderRadius: 999,
                background: tokens.ctaCircleBg,
                color: tokens.ctaCircleFg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: active ? 1 : 0,
                transform: active ? 'scale(1)' : 'scale(0.4)',
                overflow: 'hidden',
                flexShrink: 0,
                transition: `width ${TX}, opacity ${TX}, transform ${TX}, background-color 0.32s cubic-bezier(.22,1,.36,1), color 0.32s cubic-bezier(.22,1,.36,1)`,
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
                style={{ flexShrink: 0 }}
              >
                <polyline points="5 12 10 17 19 7" />
              </svg>
            </span>
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
  const { t } = useTranslation('auth')
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onChange(dark ? 'light' : 'dark')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={dark ? t('themeToggle.toLight') : t('themeToggle.toDark')}
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
        transition: 'var(--bento-tx)',
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
          transition: 'opacity 0.32s cubic-bezier(.22,1,.36,1), transform 0.32s cubic-bezier(.22,1,.36,1)',
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
          transition: 'opacity 0.32s cubic-bezier(.22,1,.36,1), transform 0.32s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {SunIcon}
      </span>
    </button>
  )
}
