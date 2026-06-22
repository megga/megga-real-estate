// MEGGA CRM Sugar v2 — Contacts helpers
// Helpers porté 1:1 du prototype `crm-screen-contacts-sugar.jsx`.

import type { CrmContact } from '../mockData'

// Traducteur injecté (cf docs/i18n-conventions.md §5) : ces helpers produisent du
// texte d'affichage et reçoivent le `t` de useTranslation depuis le composant.
export type CtT = (key: string, opts?: Record<string, unknown>) => string

export function ctScoreColor(score: number): string {
  if (score >= 80) return '#0E9F6E'
  if (score >= 60) return '#0041D9'
  if (score >= 40) return '#F59E0B'
  return '#E53935'
}

// Libellé du type de contact (affichage fiche). Clés DISTINCTES de contacts:type.*
// (qui sert aux filtres, avec une autre formulation : Bailleur / Acheteur·Vendeur).
export function ctTypeLabel(type: CrmContact['type'], t: CtT): string {
  return t('contacts:contactType.' + type, { defaultValue: type })
}

export function ctRelativeTime(iso: string | null | undefined, t: CtT): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const n = new Date()
  const ms = n.getTime() - d.getTime()
  const h = ms / 3600000
  if (h < 1) return t('contacts:relativeTime.min', { n: Math.max(1, Math.round(ms / 60000)) })
  if (h < 24) return t('contacts:relativeTime.h', { n: Math.round(h) })
  const j = Math.round(h / 24)
  if (j < 7) return t('contacts:relativeTime.j', { n: j })
  if (j < 30) return t('contacts:relativeTime.sem', { n: Math.round(j / 7) })
  return t('contacts:relativeTime.mois', { n: Math.round(j / 30) })
}

export function ctFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return 'CHF ' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'
  if (n >= 1e3) return 'CHF ' + (n / 1e3).toFixed(0) + 'k'
  return 'CHF ' + n
}

export type SegmentId = 'all' | 'buyer' | 'seller' | 'tenant' | 'hot' | 'kyc' | 'stale'

// labelKey traduit chez le consommateur : t(seg.labelKey).
export const CT_SEGMENTS: { id: SegmentId; labelKey: string }[] = [
  { id: 'all', labelKey: 'contacts:segments.all' },
  { id: 'buyer', labelKey: 'contacts:segments.buyer' },
  { id: 'seller', labelKey: 'contacts:segments.seller' },
  { id: 'tenant', labelKey: 'contacts:segments.tenant' },
  { id: 'hot', labelKey: 'contacts:segments.hot' },
  { id: 'kyc', labelKey: 'contacts:segments.kyc' },
  { id: 'stale', labelKey: 'contacts:segments.stale' },
]

export type SortMode = 'activity' | 'score' | 'name'
