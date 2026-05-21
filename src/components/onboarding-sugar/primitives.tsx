// MEGGA Onboarding — Primitives Sugar Pure
// Source : handoff-onboarding/onboarding/megga-onboarding-palette.jsx
import { useState, type CSSProperties, type ReactNode } from 'react'
import { obPalette, type ObTheme } from './tokens'

// ─── ObIcon ──────────────────────────────────────────────────────────

export type ObIconName =
  | 'search' | 'close' | 'check' | 'arrowR' | 'arrowL' | 'plus'
  | 'building' | 'user' | 'upload' | 'shield' | 'flag' | 'map'
  | 'clock' | 'sparkle' | 'info' | 'warn' | 'mail' | 'pipeline'
  | 'target' | 'home' | 'camera' | 'chevR' | 'download'

const ICON_PATHS: Record<ObIconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  check: <><path d="m5 13 4 4 10-12" /></>,
  arrowR: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
  arrowL: <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  building: <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  upload: <><path d="M12 16V4M12 4l-5 5M12 4l5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  shield: <><path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></>,
  flag: <><path d="M4 22V4M4 4h14l-2 5 2 5H4" /></>,
  map: <><path d="M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></>,
  warn: <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v5M12 18h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  pipeline: <><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="12" r="2" /><path d="M8 6h6a2 2 0 0 1 2 2v2M8 18h6a2 2 0 0 0 2-2v-2" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  home: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="4" /></>,
  chevR: <><path d="m9 6 6 6-6 6" /></>,
  download: <><path d="M12 4v12M12 16l-5-5M12 16l5-5" /><path d="M4 20h16" /></>,
}

export function ObIcon({
  name, size = 22, stroke = 'currentColor', sw = 1.6,
}: { name: ObIconName; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  )
}

// ─── CTA noir (pilule Sugar) ─────────────────────────────────────────

type PillSize = 'lg' | 'md'

export function ObBlackPill({
  children, onClick, disabled, icon, size = 'lg', dark, autoFocus,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  size?: PillSize
  dark?: boolean
  autoFocus?: boolean
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  const height = size === 'lg' ? 50 : 42
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height,
        padding: size === 'lg' ? '0 28px' : '0 20px',
        borderRadius: 999,
        border: 0,
        background: disabled ? t.ghost : h ? t.blackHover : t.black,
        color: dark ? '#0B0C0E' : '#fff',
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 14.5 : 13,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: disabled
          ? 'none'
          : h
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
        transition: 'all .18s ease',
        transform: h && !disabled ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {children}
      {icon}
    </button>
  )
}

// ─── Pilule ghost (secondaire) ───────────────────────────────────────

export function ObGhostPill({
  children, onClick, icon, dark, size = 'lg',
}: {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  dark?: boolean
  size?: PillSize
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  const height = size === 'lg' ? 50 : 42
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height,
        padding: '0 22px',
        borderRadius: 999,
        border: 0,
        background: h ? t.card : 'transparent',
        color: t.inkSoft,
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 14 : 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: h ? t.shadow : 'none',
        transition: 'all .18s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Eyebrow + Title + Sub — header d'étape uniforme ─────────────────

export function ObStepHeader({
  eyebrow, title, sub, dark,
}: {
  eyebrow?: string
  title: string
  sub?: string
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        marginBottom: 38,
        maxWidth: 680,
        animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          margin: '0 0 14px',
          fontSize: 40,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: -0.9,
          lineHeight: 1.08,
        }}
      >
        {title}
      </h1>
      {sub && (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ─── Card Sugar générique (surface blanche, ombre, pas de bordure) ───

export function ObCard({
  children, padding = 28, radius = 22, dark, style, onClick, hoverable,
}: {
  children: ReactNode
  padding?: number
  radius?: number
  dark?: boolean
  style?: CSSProperties
  onClick?: () => void
  hoverable?: boolean
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: t.card,
        borderRadius: radius,
        padding,
        boxShadow: hoverable && h ? t.shadowHov : t.shadow,
        transform: hoverable && h ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Drapeau suisse SVG ──────────────────────────────────────────────

export function ObSwissFlag({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="3" fill="#D52B1E" />
      <rect x="13" y="6" width="6" height="20" fill="#fff" />
      <rect x="6" y="13" width="20" height="6" fill="#fff" />
    </svg>
  )
}

// ─── Champ Sugar (label + control) ───────────────────────────────────

export const obInputStyle = (t: ObTheme): CSSProperties => ({
  width: '100%',
  height: 46,
  padding: '0 16px',
  borderRadius: 12,
  border: 0,
  background: t.cardSubtle,
  color: t.ink,
  fontFamily: 'inherit',
  fontSize: 14.5,
  fontWeight: 500,
  letterSpacing: -0.2,
  outline: 'none',
})

export function ObField({
  label, children, dark,
}: {
  label: string
  children: ReactNode
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: t.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
