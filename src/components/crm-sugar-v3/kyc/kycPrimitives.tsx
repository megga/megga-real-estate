// MEGGA CRM Sugar v3 — Primitives KYC palette-aware
// Port propre de crm-screen-kyc-sugar.jsx (KycBlackPill, KycGhostPill,
// KycCircleBtn, KycStatCard, KycStatusPill, KycRiskPill, KycMetaRow).
//
// Différence avec `../primitives` (statiques, partagées par les autres écrans
// Sugar) : ici chaque primitive lit `useKycPalette()` → suit le flip clair/
// sombre du handoff §3. Scoping KYC volontaire : ne pas réutiliser ailleurs.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { KYC_STATUS_LABELS, KYC_RISK_LABELS } from '../tokens'
import { useKycPalette } from './kycPalette'
import type { KycDossierStatus } from '@/types/kyc'

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
        borderRadius: 999,
        border: 0,
        background: disabled ? sp.ghost : hover ? sp.blackHover : sp.black,
        color: sp.onAccent,
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 14.5 : 13,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        whiteSpace: 'nowrap',
        boxShadow: disabled
          ? 'none'
          : hover
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
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
        borderRadius: 999,
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
          ? '0 6px 16px rgba(11,12,14,0.18)'
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
        borderRadius: 999,
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

// ─── Carte stat (bento header liste) ───────────────────────────────────
// Handoff §8 : pastilles (dots) retirées des 4 stat cards.
interface StatCardProps {
  label: string
  value: ReactNode
  sub?: string
}

export function KycStatCard({ label, value, sub }: StatCardProps) {
  const sp = useKycPalette()
  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 22,
        padding: '22px 24px',
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
        minHeight: 124,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: sp.muted,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: -1.4,
            lineHeight: 1,
            color: sp.ink,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: sp.muted, marginTop: 8 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Pilule de statut (fond plein opaque, texte blanc — handoff §6) ─────
export function KycStatusPill({ status }: { status: KycDossierStatus }) {
  const sp = useKycPalette()
  const meta = KYC_STATUS_LABELS[status] ?? { label: status, tone: sp.muted }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 999,
        background: meta.tone,
        color: '#fff',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

// ─── Pilule de risque (fond plein opaque, texte blanc — handoff §6) ─────
export function KycRiskPill({ risk }: { risk: keyof typeof KYC_RISK_LABELS }) {
  const sp = useKycPalette()
  const meta = KYC_RISK_LABELS[risk] ?? { label: risk, tone: sp.muted }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 999,
        background: meta.tone,
        color: '#fff',
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

// ─── Ligne clé / valeur (bloc Informations de la Synthèse) ──────────────
interface MetaRowProps {
  label: string
  children: ReactNode
  last?: boolean
}

export function KycMetaRow({ label, children, last }: MetaRowProps) {
  const sp = useKycPalette()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 0',
        borderBottom: last ? 'none' : `1px solid ${sp.cardSubtle}`,
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          color: sp.muted,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: sp.ink,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textAlign: 'right',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        {children}
      </span>
    </div>
  )
}
