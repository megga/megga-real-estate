// MEGGA CRM Sugar v2 — KYC atoms (Tier 4)
// 1:1 port from `megga-kyc-variations.jsx` (SP tokens + Pill/BlackBtn/GhostBtn/Avatar/Icon).
/* eslint-disable react-refresh/only-export-components */

import { useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// iOS UIButton tap-feedback spring used by BlackBtn + GhostBtn (KYC actions).
const TAP_SPRING = { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.6 }

// ─── Tokens partagés Sugar Pure ──────────────────────────────────────────
export const SP = {
  bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  surface: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadowLg: '0 24px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)',
  // LBA / conformité — couleurs métier réservées aux statuts
  ok: '#0E9F6E',
  okSoft: '#E1F5EC',
  warn: '#C45A00',
  warnSoft: '#FCEAD9',
  danger: '#B91C1C',
  dangerSoft: '#FDECEA',
  pending: '#0891B2',
  pendingSoft: '#DCEEF2',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
}

export type KycTone = 'ok' | 'warn' | 'danger' | 'pending' | 'neutral'

// ─── Pill ─────────────────────────────────────────────────────────────────
interface PillProps {
  tone: KycTone
  children: ReactNode
  dot?: boolean
}

export function Pill({ tone, children, dot }: PillProps) {
  const tones: Record<KycTone, { fg: string; bg: string }> = {
    ok: { fg: SP.ok, bg: SP.okSoft },
    warn: { fg: SP.warn, bg: SP.warnSoft },
    danger: { fg: SP.danger, bg: SP.dangerSoft },
    pending: { fg: SP.pending, bg: SP.pendingSoft },
    neutral: { fg: SP.inkSoft, bg: SP.cardSubtle },
  }
  const t = tones[tone] || tones.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.1,
        background: t.bg,
        color: t.fg,
      }}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: 999, background: t.fg }}
        />
      )}
      {children}
    </span>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '.09em',
        textTransform: 'uppercase',
        color: SP.muted,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

// ─── BlackBtn ─────────────────────────────────────────────────────────────
interface BlackBtnProps {
  children: ReactNode
  icon?: ReactNode
  onClick?: () => void
  style?: CSSProperties
}

export function BlackBtn({ children, icon, onClick, style }: BlackBtnProps) {
  const [hover, setHover] = useState(false)
  const reducedMotion = useReducedMotion()
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={TAP_SPRING}
      style={{
        height: 44,
        padding: '0 22px',
        borderRadius: 999,
        background: hover ? SP.blackHover : SP.black,
        color: '#fff',
        border: 0,
        fontSize: 13.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: SP.font,
        letterSpacing: -0.1,
        boxShadow: hover
          ? '0 12px 30px rgba(11,12,14,0.25)'
          : '0 6px 16px rgba(11,12,14,0.18)',
        transition: 'all .18s ease',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        ...style,
      }}
    >
      {icon}
      {children}
    </motion.button>
  )
}

// ─── GhostBtn ─────────────────────────────────────────────────────────────
interface GhostBtnProps {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}

export function GhostBtn({ children, onClick, style }: GhostBtnProps) {
  const [hover, setHover] = useState(false)
  const reducedMotion = useReducedMotion()
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={TAP_SPRING}
      style={{
        height: 40,
        padding: '0 18px',
        borderRadius: 999,
        background: hover ? SP.cardSubtle : 'transparent',
        color: SP.inkSoft,
        border: 0,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: SP.font,
        transition: 'background .15s',
        ...style,
      }}
    >
      {children}
    </motion.button>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string
  size?: number
}

export function Avatar({ name, size = 44 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: '#0B0C0E',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        letterSpacing: -0.3,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

// ─── Icon factory + paths ─────────────────────────────────────────────────
export type KycIconName =
  | 'shield' | 'check' | 'alert' | 'user' | 'doc' | 'bank' | 'globe'
  | 'arrow' | 'upload' | 'scan' | 'spark' | 'clock' | 'lock' | 'chev'
  | 'x' | 'plus' | 'flag'

const KYC_PATHS: Record<KycIconName, ReactNode> = {
  shield: <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />,
  check: <path d="M5 12l4 4 10-10" />,
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r=".5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v9M19 10v9M9 10v9M15 10v9" />
      <path d="M3 20h18" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </>
  ),
  scan: (
    <>
      <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
      <path d="M4 12h16" />
    </>
  ),
  spark: <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  flag: (
    <>
      <path d="M5 21V5" />
      <path d="M5 5h11l-2 4 2 4H5" />
    </>
  ),
}

interface KycIconProps {
  name: KycIconName
  size?: number
  stroke?: string
  fill?: string
  sw?: number
}

export function KycIcon({
  name,
  size = 16,
  stroke = 'currentColor',
  fill = 'none',
  sw = 1.6,
}: KycIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {KYC_PATHS[name] || null}
    </svg>
  )
}
