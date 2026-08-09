// MEGGA CRM — KYC Pager · atomes (icônes, avatar, pilules, jauge, CTA)
// Port fidèle des atomes du prototype `kyc-pager-proto.jsx`.

import type { CSSProperties, ReactNode } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { crmInitials } from '@/components/crm-sugar/tokens'
import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import { KYP_FONT, kypStatusMeta } from './kypTokens'

// ─── Icônes SVG linéaires (stroke) ──────────────────────────────────────
export function KypIcon({ name, size = 15, sw = 2 }: { name: string; size?: number; sw?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'link':
      return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
    case 'shield':
      return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /></svg>
    case 'doc':
      return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
    case 'send':
      return <svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
    case 'id':
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2.2" /><path d="M14 10h4M14 14h4" /></svg>
    case 'home':
      return <svg {...p}><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /></svg>
    case 'flag':
      return <svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
    case 'ban':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></svg>
    case 'coins':
      return <svg {...p}><circle cx="9" cy="9" r="6" /><circle cx="15" cy="15" r="6" /></svg>
    case 'check':
      return <svg {...p}><path d="m5 13 4 4 10-12" /></svg>
    case 'checkAll':
      return <svg {...p}><path d="m2 13 4 4 10-12" /><path d="m9 15 3 3 10-12" /></svg>
    case 'arrowL':
      return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>
    case 'arrowR':
      return <svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
    case 'download':
      return <svg {...p}><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg>
    case 'upload':
      return <svg {...p}><path d="M12 15V4" /><path d="m7 8 5-5 5 5" /><path d="M5 20h14" /></svg>
    case 'clip':
      return <svg {...p}><path d="m21.4 11.05-8.7 8.7a5.5 5.5 0 0 1-7.78-7.78l8.7-8.7a3.67 3.67 0 0 1 5.19 5.19l-8.7 8.7a1.83 1.83 0 0 1-2.6-2.6l8.05-8.04" /></svg>
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
    default:
      return null
  }
}

// ─── Avatar initiales avec anneau ───────────────────────────────────────
export function KypAvatar({
  firstName,
  lastName,
  avatarBg,
  size = 34,
  ring = '#fff',
}: {
  firstName: string
  lastName: string
  avatarBg?: string | null
  size?: number
  ring?: string
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--crm-radius-pill)',
        flexShrink: 0,
        background: avatarBg || '#0B0C0E',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.34,
        fontWeight: 700,
        letterSpacing: 0.2,
        boxShadow: `0 0 0 2px ${ring}`,
      }}
    >
      {crmInitials(`${firstName} ${lastName}`)}
    </div>
  )
}

// ─── Pilule pleine générique (statut / risque) ──────────────────────────
export function KypPill({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-pill)',
        background: tone,
        color: '#fff',
        fontSize: 'var(--crm-text-sm)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

export function KypStatusPill({ status }: { status: KycDossierStatus }) {
  const s = kypStatusMeta(status)
  return <KypPill tone={s.tone} label={s.label} />
}

// ─── CTA accent (noir pur / encre claire en sombre) ─────────────────────
export function KypCta({
  children,
  sp,
  onClick,
  h = 34,
  disabled,
}: {
  children: ReactNode
  sp: SugarPalette
  onClick?: () => void
  h?: number
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        height: h,
        padding: '0 var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-pill)',
        background: disabled ? sp.sub : sp.focusBg,
        color: sp.focusInk,
        border: 0,
        fontFamily: KYP_FONT,
        fontSize: 'var(--crm-text-md)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

/** Icône de contrôle (id/home/flag/ban/coins). */
export function KypCheckIcon({ category, size = 16, sw = 1.7 }: { category: KycCheckCategory; size?: number; sw?: number }) {
  const map: Record<KycCheckCategory, string> = {
    id: 'id',
    address: 'home',
    pep: 'flag',
    sanctions: 'ban',
    funds: 'coins',
  }
  return <KypIcon name={map[category]} size={size} sw={sw} />
}

export type { CSSProperties }
