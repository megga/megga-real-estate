// MEGGA — Primitives Sugar Pure pour le parcours client KYC Magic Link
// Sprint 4.7.C — Calque pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
// (préfixe Mlk* conservé pour fidélité au canon Claude Design).
//
// Important : ces primitives sont AUTONOMES (ne dépendent ni de SugarV3 ni
// du layout agent). Elles servent UNIQUEMENT les écrans publics `/kyc/<token>`
// que la cliente consulte sans compte MEGGA.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
// Jetons déplacés dans mlkTokens.ts : ce fichier n'exporte que des composants
// (contrainte Fast Refresh). Voir l'en-tête de mlkTokens.ts.
import { MLK } from './mlkTokens'

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
  // Desktop : N colonnes (1 par item). Mobile < 560px : 2 colonnes (grid auto-fit).
  // Le CSS @media est injecté en bas via MlkBackground (composant racine).
  return (
    <div className="mlk-reassure-row" data-cols={items.length}>
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
  // `rel="noreferrer"` empêche le token magic-link de fuiter dans le header
  // Referer envoyé aux pages externes (mentions-legales, confidentialité).
  // `target="_blank"` ouvre dans un nouvel onglet pour préserver le parcours KYC.
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
        <a
          href="/mentions-legales"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          Mentions légales
        </a>
        <a
          href="/confidentialite"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
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
  // Padding et border-radius adaptés mobile via classe + @media query
  // (injectée par MlkBackground). Sur mobile : padding réduit, radius plus serré.
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
        className="mlk-shell"
        style={
          {
            width,
            maxWidth: 'calc(100vw - 32px)',
            background: MLK.card,
            borderRadius: 32,
            boxShadow: MLK.shadowLg,
            // Variable CSS lue par @media query pour mobile
            ['--mlk-shell-pad' as string]: `${pad}px`,
            padding: 'var(--mlk-shell-pad)',
            animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
            ...style,
          } as CSSProperties
        }
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
        /* Grid réassurance : N colonnes desktop, 2 colonnes < 560px */
        .mlk-reassure-row {
          display: grid;
          gap: 16px;
        }
        .mlk-reassure-row[data-cols="1"] { grid-template-columns: 1fr; }
        .mlk-reassure-row[data-cols="2"] { grid-template-columns: repeat(2, 1fr); }
        .mlk-reassure-row[data-cols="3"] { grid-template-columns: repeat(3, 1fr); }
        .mlk-reassure-row[data-cols="4"] { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 560px) {
          .mlk-reassure-row[data-cols="3"],
          .mlk-reassure-row[data-cols="4"] {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        /* Shell padding réduit sur mobile pour gagner de l'espace */
        @media (max-width: 560px) {
          .mlk-shell {
            padding: calc(var(--mlk-shell-pad) * 0.5) !important;
            border-radius: 22px !important;
          }
        }
        /* Titres H1 plus petits sur mobile (pas de débordement < 380px) */
        @media (max-width: 480px) {
          .mlk-h1 {
            font-size: 26px !important;
            letter-spacing: -0.5px !important;
            line-height: 1.15 !important;
          }
        }
      `}</style>
      {children}
    </div>
  )
}
