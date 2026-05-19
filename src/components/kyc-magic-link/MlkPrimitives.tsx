// MEGGA — Primitives Sugar Pure pour le parcours client KYC Magic Link
// Sprint 4.7.C — Calque pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
// (préfixe Mlk* conservé pour fidélité au canon Claude Design).
//
// Important : ces primitives sont AUTONOMES (ne dépendent ni de SugarV3 ni
// du layout agent). Elles servent UNIQUEMENT les écrans publics `/kyc/<token>`
// que la cliente consulte sans compte MEGGA.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// ─── Palette Sugar Pure (subset utilisé par les écrans clients) ───────────

export const MLK = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
  shadowHover: '0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)',
  font: 'Manrope, system-ui, sans-serif',
} as const

// ─── Icônes line-stroke (subset utilisé par les écrans clients) ───────────

type MlkIconName =
  | 'check'
  | 'checkCircle'
  | 'lock'
  | 'shield'
  | 'swiss'
  | 'clock'
  | 'file'
  | 'fileText'
  | 'upload'
  | 'camera'
  | 'arrowR'
  | 'arrowL'
  | 'x'
  | 'chevronR'
  | 'alert'
  | 'mail'
  | 'id'
  | 'home'
  | 'coins'
  | 'scale'
  | 'flag'
  | 'refresh'

const PATHS: Record<MlkIconName, ReactNode> = {
  check: <path d="m5 13 4 4 10-12" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  swiss: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 7h6v3h3v4h-3v3H9v-3H6v-4h3z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  arrowR: <path d="M5 12h14M12 5l7 7-7 7" />,
  arrowL: <path d="M19 12H5M12 19l-7-7 7-7" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  chevronR: <path d="m9 6 6 6-6 6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v9h14v-9" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="6" />
      <circle cx="15" cy="15" r="6" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18" />
      <path d="M5 8h14" />
      <path d="m5 8-2 5a4 4 0 0 0 8 0Z" />
      <path d="m19 8-2 5a4 4 0 0 0 8 0Z" />
    </>
  ),
  flag: (
    <>
      <path d="M4 21V4" />
      <path d="M4 5h13l-2 4 2 4H4" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
}

interface MlkIconProps {
  name: MlkIconName
  size?: number
  stroke?: string
  sw?: number
}

export function MlkIcon({ name, size = 22, stroke = 'currentColor', sw = 1.6 }: MlkIconProps) {
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
      {PATHS[name]}
    </svg>
  )
}

// ─── Boutons signature ────────────────────────────────────────────────────

interface BlackPillProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  iconRight?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  type?: 'button' | 'submit'
}

export function MlkBlackPill({
  children,
  onClick,
  icon,
  iconRight,
  disabled,
  size = 'lg',
  full,
  type = 'button',
}: BlackPillProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 54 : size === 'md' ? 46 : 38
  const pad = size === 'lg' ? '0 28px' : size === 'md' ? '0 22px' : '0 18px'
  const fs = size === 'lg' ? 15 : size === 'md' ? 14 : 12.5
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: pad,
        borderRadius: 999,
        border: 0,
        background: disabled ? MLK.ghost : hover ? MLK.blackHover : MLK.black,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: full ? 'flex' : 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
        width: full ? '100%' : 'auto',
        boxShadow: disabled
          ? 'none'
          : hover
            ? '0 14px 32px rgba(11,12,14,0.28)'
            : '0 8px 20px rgba(11,12,14,0.20)',
        transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
      }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}

interface GhostPillProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  disabled?: boolean
}

export function MlkGhostPill({ children, onClick, icon, disabled }: GhostPillProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 44,
        padding: '0 20px',
        borderRadius: 999,
        border: 0,
        background: hover ? MLK.card : 'transparent',
        color: disabled ? MLK.muted : MLK.inkSoft,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: hover && !disabled ? MLK.shadowSm : 'none',
        transition: 'all .18s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Wordmark, Avatar, ReassureRow, Footer, Shell ─────────────────────────

export function MlkWordmark({ size = 18 }: { size?: number }) {
  // Fallback wordmark texte si l'image ne charge pas
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <img
        src="/megga-logo.svg"
        alt="MEGGA"
        style={{
          height: size * 0.85,
          width: 'auto',
          display: 'block',
        }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          const sib = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null
          if (sib) sib.style.display = 'block'
        }}
      />
      <div
        style={{
          display: 'none',
          fontFamily: 'Manrope, sans-serif',
          fontSize: size,
          fontWeight: 800,
          letterSpacing: -1.5,
          color: MLK.ink,
        }}
      >
        MEGGA
      </div>
    </div>
  )
}

export function MlkAgentAvatar({
  name,
  color = '#3B82F6',
  size = 56,
}: {
  name: string
  color?: string
  size?: number
}) {
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.max(13, size * 0.34),
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: `0 0 0 4px ${color}26`,
      }}
    >
      {initials.toUpperCase() || 'A'}
    </div>
  )
}

interface ReassureItem {
  icon: MlkIconName
  title: string
  sub: string
}

export function MlkReassureRow({ items }: { items: ReassureItem[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 16,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '16px 4px 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: MLK.cardSubtle,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <MlkIcon name={it.icon} size={17} stroke={MLK.ink} sw={1.7} />
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: MLK.ink,
              letterSpacing: -0.1,
              marginTop: 2,
            }}
          >
            {it.title}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: MLK.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {it.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MlkFooter() {
  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        fontSize: 11,
        color: MLK.muted,
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', gap: 18 }}>
        <a href="/mentions-legales" style={{ color: 'inherit', textDecoration: 'none' }}>
          Mentions légales
        </a>
        <a href="/confidentialite" style={{ color: 'inherit', textDecoration: 'none' }}>
          Confidentialité
        </a>
      </div>
    </div>
  )
}

interface ShellProps {
  children: ReactNode
  width?: number
  pad?: number
  style?: CSSProperties
}

export function MlkShell({ children, width = 720, pad = 56, style }: ShellProps) {
  return (
    <div
      style={{
        width: '100%',
        fontFamily: MLK.font,
        color: MLK.ink,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width,
          maxWidth: 'calc(100vw - 32px)',
          background: MLK.card,
          borderRadius: 32,
          boxShadow: MLK.shadowLg,
          padding: pad,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Page-level background gradient (used by KycPublicPage)
export function MlkBackground({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: MLK.bgGradient,
        padding: '48px 16px',
        fontFamily: MLK.font,
        color: MLK.ink,
      }}
    >
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  )
}
