/**
 * Utilitaires transverses : fusion de classes Tailwind (`cn`) et formateurs
 * localisés (CHF à l'apostrophe suisse, dates DD.MM.YYYY, surfaces, loyer). Les
 * formateurs monétaires sont type-defensive (acceptent string/null) pour
 * encaisser sans planter les valeurs brutes des <input> RHF.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, type Locale } from 'date-fns'
import { fr, enUS, de, it } from 'date-fns/locale'
import i18n from '@/i18n'

// Locale date-fns suivant la langue active (i18n). FR par défaut. Permet aux
// libellés de date écrits en toutes lettres (jour/mois) de se localiser sans
// changer les formats numériques suisses (DD.MM.YYYY) ni le séparateur CHF.
/**
 * Locale date-fns correspondant à la langue active.
 *
 * Exportée pour les surfaces qui formatent des dates hors des helpers ci-dessous
 * — la page publique de réservation, qui compose ses propres libellés de jour et
 * d'heure dans le fuseau de l'agent (TZDate). Redéclarer la correspondance
 * ailleurs la ferait diverger au premier ajout de langue.
 */
export function dfLocale(): Locale {
  const l = i18n.language || 'fr'
  if (l.startsWith('en')) return enUS
  if (l.startsWith('de')) return de
  if (l.startsWith('it')) return it
  return fr
}

/**
 * Merge Tailwind classes with clsx + tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format price in CHF with Swiss apostrophe separator
 * Example: 720000 → "CHF 720'000"
 *
 * Type-defensive: accepts string/null/undefined safely (RHF watch() returns
 * strings from <input type="number">). Returns "CHF —" for missing or invalid
 * input (null, undefined, empty string, non-numeric string) instead of
 * crashing with `.toFixed is not a function` or pretending an absent value
 * is zero.
 */
export function formatCHF(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'CHF —'
  const n = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(n)) return 'CHF —'
  const formatted = n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  return `CHF ${formatted}`
}

/**
 * Format date in Swiss format DD.MM.YYYY
 * Example: 2026-03-16 → "16.03.2026"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd.MM.yyyy', { locale: dfLocale() })
}

/**
 * Format a date as the « Aujourd'hui » header label, capitalized.
 * Example: "Dimanche 14 juin"
 */
export function formatTodayHeader(date: Date = new Date()): string {
  const s = format(date, 'EEEE d MMMM', { locale: dfLocale() })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Format date as relative time in French
 * Example: "il y a 2 heures"
 */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: fr })
}

/**
 * Format surface area
 * Example: 120 → "120 m²"
 */
export function formatSurface(m2: number): string {
  return `${m2} m²`
}

/**
 * Format rent amount in CHF with monthly suffix
 * Example: 2500 → "CHF 2'500/mois"
 *
 * Type-defensive: same coercion as formatCHF. Returns "CHF —/mois" for
 * invalid input instead of crashing.
 */
export function formatRent(amount: number | string | null | undefined): string {
  return `${formatCHF(amount)}/mois`
}
