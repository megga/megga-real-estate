// Atelier Matching — helpers de format (CHF apostrophes, millions, dates FR-CH).

import { formatCHF } from '@/lib/utils'

/** CHF 1'100'000 — « — » si invalide (type-defensive, règle CLAUDE.md) */
export function sgaFmtCHF(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—'
  return formatCHF(n)
}

/** 1100000 → « 1,1M » (libellés budget compacts du handoff) */
export function fmtM(p: number): string {
  return String(Math.round(p / 10000) / 100).replace('.', ',') + 'M'
}

/** Fourchette budget « 0,9–1,3M » depuis criteria */
export function fmtBudgetRange(min?: number, max?: number): string {
  if (min && max) return `${fmtM(min)}–${fmtM(max)}`
  if (max) return `≤ ${fmtM(max)}`
  if (min) return `≥ ${fmtM(min)}`
  return '—'
}

/** Date de retour d'un report (J+7), format « 17 juin » */
export function sgaReturnDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 864e5)
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
}

/** Couleur d'un score (≥80 ink, ≥60 soft, sinon muted) */
export const sgaScoreColor = (s: number): string =>
  s >= 80 ? 'var(--ink)' : s >= 60 ? 'var(--ink-soft)' : 'var(--ink-muted)'

export const sgaInitials = (first: string, last: string): string =>
  `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
