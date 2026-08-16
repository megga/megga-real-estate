// MEGGA CRM Sugar v3 — Primitives KYC palette-aware
// Port propre de crm-screen-kyc-sugar.jsx (KycBlackPill, KycGhostPill,
// KycCircleBtn).
//
// Différence avec `../primitives` (statiques, partagées par les autres écrans
// Sugar) : ici chaque primitive lit `useKycPalette()` → suit le flip clair/
// sombre du handoff §3. Scoping KYC volontaire : ne pas réutiliser ailleurs.

import { crmVoileEncre } from '@/components/crm/tokens'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useKycPalette } from './kycPalette'

// ─── Pilule accent (CTA principal) ─────────────────────────────────────
interface BlackPillProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  /** `md` = 40px, `lg` = 50px. */
  size?: 'md' | 'lg'
  style?: CSSProperties
  title?: string
}

export function KycBlackPill({
  children,
  onClick,
  disabled,
  icon,
  size = 'md',
  style,
  title,
}: BlackPillProps) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 50 : 40
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'lg' ? '0 26px' : '0 18px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        // ⚠ AUCUN changement de couleur au survol, et c'est une mesure : la
        // feuille de la vitrine ne donne à `.primary-button:hover` qu'un
        // `scale3d(1.04)`. La réponse au survol est GÉOMÉTRIQUE, et elle est
        // déjà là — `translateY(-1px)` et l'ombre renforcée, plus bas.
        background: disabled ? sp.ghost : sp.black,
        color: sp.onAccent,
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 'var(--crm-text-lg)' : 'var(--crm-text-md)',
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        whiteSpace: 'nowrap',
        boxShadow: disabled
          ? 'none'
          : hover
            ? `0 12px 30px ${crmVoileEncre(false, 0.25)}`
            : `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
        transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Pilule fantôme ────────────────────────────────────────────────────
interface GhostPillProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  active?: boolean
  size?: 'sm' | 'md'
  style?: CSSProperties
  disabled?: boolean
  title?: string
}

export function KycGhostPill({
  children,
  onClick,
  icon,
  active,
  size = 'md',
  style,
  disabled,
  title,
}: GhostPillProps) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)
  const h = size === 'sm' ? 36 : 40
  const fontSize = size === 'sm' ? 12.5 : 13
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'sm' ? '0 14px' : '0 18px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: active ? sp.black : hover ? sp.card : 'transparent',
        color: active ? sp.onAccent : sp.inkSoft,
        fontFamily: 'inherit',
        fontSize,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 7 : 8,
        whiteSpace: 'nowrap',
        boxShadow: active
          ? `0 6px 16px ${crmVoileEncre(false, 0.18)}`
          : hover
            ? sp.shadow
            : 'none',
        transition: 'all .18s ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Bouton circulaire ──────────────────────────────────────────────────
interface CircleBtnProps {
  icon: ReactNode
  onClick?: () => void
  title?: string
  size?: number
}

export function KycCircleBtn({ icon, onClick, title, size = 44 }: CircleBtnProps) {
  const sp = useKycPalette()
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: sp.cardSubtle,
        color: sp.inkSoft,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        boxShadow: sp.shadowSm,
        transition: 'all .18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = sp.card
        e.currentTarget.style.boxShadow = sp.shadow
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = sp.cardSubtle
        e.currentTarget.style.boxShadow = sp.shadowSm
      }}
    >
      {icon}
    </button>
  )
}

