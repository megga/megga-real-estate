/**
 * Calcul d'une grille de calendrier mensuelle, sur des dates-SEULES.
 *
 * Partagé par les deux sélecteurs de date du dépôt : `MxDatePicker` (onboarding,
 * peau de la vitrine) et le calendrier de la fiche express (`NewContactModal`,
 * peau du CRM). Les deux peaux diffèrent ; les pièges de calendrier, eux, sont les
 * mêmes, et une seule copie doit en recevoir la prochaine correction.
 *
 * ⛔ AUCUN INSTANT ICI. Une date de naissance ne traverse aucun fuseau : tout se
 * compose et se compare en composantes LOCALES, jamais par `toISOString()` ni par
 * `new Date('YYYY-MM-DD')`, qui passent par l'UTC et rendent la veille selon le
 * fuseau.
 */

/** Date décomposée — `m` compte à partir de 0, comme `Date`. */
interface JourCalendrier { y: number; m: number; d: number }

/**
 * ISO `YYYY-MM-DD` depuis des composantes LOCALES.
 *
 * ⚠ Jamais `toISOString()` : il convertit en UTC, donc le 15 mai à minuit
 * heure locale ressort « 1980-05-14T22:00Z » et la date perd un jour dès qu'on
 * est à l'est de Greenwich.
 */
export function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** L'inverse, tout aussi local : `new Date('1980-05-15')` parserait en UTC. */
export function fromIso(iso: string | null): JourCalendrier | null {
  if (!iso) return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!parts) return null
  return { y: Number(parts[1]), m: Number(parts[2]) - 1, d: Number(parts[3]) }
}

/** Jours du mois — `new Date(y, m + 1, 0)` donne le dernier jour du mois `m`. */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

/**
 * Rang du 1er du mois dans une semaine qui commence LUNDI (0 = lundi).
 * `getDay()` compte à partir de dimanche : le décalage suisse est donc `+6 % 7`.
 */
export function leadingBlanks(y: number, m: number): number {
  return (new Date(y, m, 1).getDay() + 6) % 7
}

/** Comparaison de dates-seules ISO, sans jamais construire d'instant. */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
