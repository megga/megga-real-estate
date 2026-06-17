// MEGGA CRM Sugar v2 — Matching premium pills
// 1:1 port from `crm-screen-matching-sugar.jsx` (MR_PILL, MPremiumPill,
// MStatusDot, MKycChip, MBienStatusPill). Cf. HANDOFF_PILLS_PREMIUM.md.

import type { CSSProperties } from 'react'
import type { CrmContact } from '../mockData'
import type { MatchingTab } from './helpers'

export type PillTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

interface PillStyle {
  bg: string
  fg: string
  shadow: string
  dot: string
}

// Pilules premium — cf. window.CRM_PILL / HANDOFF_PILLS_PREMIUM.md
// Fond plein couleur sombre + texte blanc + ombre douce + inset light.
// Tons : ok (vert forêt) · warn (cognac) · danger (bordeaux) · info (navy) · neutral (ink).
export const MR_PILL: Record<PillTone, PillStyle> = {
  ok: {
    bg: '#15643F',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(21,100,63,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#7CD8A6',
  },
  warn: {
    bg: '#A0521E',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(160,82,30,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#F5C58A',
  },
  danger: {
    bg: '#8E1F3D',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(142,31,61,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#F0A1B5',
  },
  info: {
    bg: '#1B4A8E',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(27,74,142,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#A3C1EE',
  },
  neutral: {
    bg: '#202127',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#9CA0AC',
  },
}

type PillSize = 'sm' | 'md' | 'lg'

interface MPremiumPillProps {
  tone: PillTone
  label: string
  size?: PillSize
  style?: CSSProperties
}

// Helper de rendu d'une pill premium (sans dot, format header acheteur / KYC).
export function MPremiumPill({
  tone,
  label,
  size = 'md',
  style,
}: MPremiumPillProps) {
  const p = MR_PILL[tone] || MR_PILL.neutral
  const padding =
    size === 'sm' ? '2px 8px' : size === 'lg' ? '5px 11px' : '3px 9px'
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 12 : 10.5
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        boxShadow: p.shadow,
        fontSize,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </span>
  )
}

// Pill de statut acheteur (À envoyer / Engagé / Sans retour / Archivé)
// 'all' n'est jamais retourné par tabOfGroup → omis de la map.
type BuyerStatusTab = Exclude<MatchingTab, 'all'>

const STATUS_MAP: Record<BuyerStatusTab, { tone: PillTone; label: string }> = {
  'to-send': { tone: 'info', label: 'À envoyer' },
  engaged: { tone: 'ok', label: 'Engagé' },
  'no-reply': { tone: 'warn', label: 'Sans retour' },
  archived: { tone: 'neutral', label: 'Archivé' },
}

interface MStatusDotProps {
  status: MatchingTab
}

export function MStatusDot({ status }: MStatusDotProps) {
  const key: BuyerStatusTab = status === 'all' ? 'to-send' : status
  const m = STATUS_MAP[key] || STATUS_MAP['to-send']
  return <MPremiumPill tone={m.tone} label={m.label} />
}

// Pastille d'état d'un bien dans le focus :
// visite planifiée > réaction client (aimé / pas intéressé) > envoyé.
type BienStatus = 'scheduled' | 'sent' | 'liked' | 'viewed' | 'rejected'

const BIEN_STATUS_MAP: Record<BienStatus, { tone: PillTone; label: string }> = {
  scheduled: { tone: 'ok', label: 'Visite planifiée' },
  sent: { tone: 'info', label: 'Envoyé' },
  liked: { tone: 'ok', label: 'Aimé' },
  viewed: { tone: 'info', label: 'Vu' },
  rejected: { tone: 'danger', label: 'Pas intéressé' },
}

interface MBienStatusPillProps {
  status: BienStatus | null | undefined
}

export function MBienStatusPill({ status }: MBienStatusPillProps) {
  if (!status) return null
  const m = BIEN_STATUS_MAP[status]
  if (!m) return null
  return <MPremiumPill tone={m.tone} label={m.label} size="sm" />
}

// Chip KYC pour le header acheteur. Reprend la grammaire de SgKycChip du wizard.
const KYC_MAP: Record<CrmContact['kyc']['status'], { tone: PillTone; label: string }> = {
  verified: { tone: 'ok', label: 'KYC vérifié' },
  pending: { tone: 'warn', label: 'KYC en cours' },
  none: { tone: 'danger', label: 'KYC à faire' },
  stale: { tone: 'warn', label: 'KYC à re-screener' },
}

interface MKycChipProps {
  kyc: CrmContact['kyc'] | undefined
}

export function MKycChip({ kyc }: MKycChipProps) {
  const status = kyc?.status || 'none'
  const m = KYC_MAP[status] || KYC_MAP.none
  return <MPremiumPill tone={m.tone} label={m.label} />
}
