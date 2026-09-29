/**
 * Matching au téléphone — les formats de l'écran mobile et de sa lecture (`useAtelierMatching`) : la date de retour
 * d'un report, et la fourchette de budget compacte d'un acheteur (`AtelierBuyer.budget`), qu'aucun écran n'affiche —
 * l'écran mobile lit les critères eux-mêmes.
 */

/** 1100000 → « 1,1M » (libellés budget compacts du handoff) */
function fmtM(p: number): string {
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
export function atlReturnDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 864e5)
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
}
