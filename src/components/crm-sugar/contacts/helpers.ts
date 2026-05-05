// MEGGA CRM Sugar v2 — Contacts helpers
// Helpers porté 1:1 du prototype `crm-screen-contacts-sugar.jsx`.

import type { CrmContact } from '../mockData'

export function ctScoreColor(score: number): string {
  if (score >= 80) return '#0E9F6E'
  if (score >= 60) return '#0041D9'
  if (score >= 40) return '#F59E0B'
  return '#E53935'
}

export function ctTypeLabel(type: CrmContact['type']): string {
  return ({
    buyer: 'Acheteur',
    seller: 'Vendeur',
    tenant: 'Locataire',
    landlord: 'Propriétaire',
    mixed: 'Mixte',
  } as const)[type] || type
}

export function ctRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const n = new Date()
  const ms = n.getTime() - d.getTime()
  const h = ms / 3600000
  if (h < 1) return 'il y a ' + Math.max(1, Math.round(ms / 60000)) + ' min'
  if (h < 24) return 'il y a ' + Math.round(h) + ' h'
  const j = Math.round(h / 24)
  if (j < 7) return 'il y a ' + j + ' j'
  if (j < 30) return 'il y a ' + Math.round(j / 7) + ' sem'
  return 'il y a ' + Math.round(j / 30) + ' mois'
}

export function ctFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return 'CHF ' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'
  if (n >= 1e3) return 'CHF ' + (n / 1e3).toFixed(0) + 'k'
  return 'CHF ' + n
}

export type SegmentId = 'all' | 'buyer' | 'seller' | 'tenant' | 'hot' | 'kyc' | 'stale'

export const CT_SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'buyer', label: 'Acheteurs' },
  { id: 'seller', label: 'Vendeurs' },
  { id: 'tenant', label: 'Locataires' },
  { id: 'hot', label: 'Leads chauds' },
  { id: 'kyc', label: 'KYC à compléter' },
  { id: 'stale', label: 'Sans activité 14j+' },
]

export type SortMode = 'activity' | 'score' | 'name'
