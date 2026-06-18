import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  return format(d, 'dd.MM.yyyy', { locale: fr })
}

/**
 * Format a date as the « Aujourd'hui » header label, capitalized.
 * Example: "Dimanche 14 juin"
 */
export function formatTodayHeader(date: Date = new Date()): string {
  const s = format(date, 'EEEE d MMMM', { locale: fr })
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

/**
 * Resolve which contact to display for a rental listing.
 * external_regie (JSONB per-listing override) > agency fallback.
 * Returns the regie/agency contact object, or null if neither available.
 */
export interface RegieContact {
  name: string
  phone?: string
  email?: string
  website?: string
}

/**
 * Merge external_regie (per-listing override) over agency fallback,
 * field by field. Any field that exists is surfaced — we no longer
 * require all of {name, phone, email} to be present.
 * Returns null only when NO usable info exists at all.
 */
export function resolveRegieContact(
  listing: { external_regie?: Partial<RegieContact> | null },
  agency: { name?: string; phone?: string; email?: string; website?: string } | null | undefined
): RegieContact | null {
  const r = listing.external_regie ?? {}
  const a = agency ?? {}
  const name = r.name || a.name || ''
  const phone = r.phone || a.phone || undefined
  const email = r.email || a.email || undefined
  const website = r.website || a.website || undefined
  if (!name && !phone && !email && !website) return null
  return { name, phone, email, website }
}

/**
 * Format price for map pin display (compact)
 * Rent: 2500 → "2.5K/mois", 3000 → "3K/mois"
 * Buy: 1_200_000 → "1.2M", 720_000 → "720K"
 */
export function formatPricePin(price: number, transactionType: 'buy' | 'rent' = 'buy'): string {
  if (transactionType === 'rent') {
    if (price >= 1000) {
      const k = price / 1000
      return k % 1 === 0 ? `${k.toFixed(0)}K/mois` : `${k.toFixed(1)}K/mois`
    }
    return `${price}/mois`
  }

  if (price >= 1_000_000) {
    const m = price / 1_000_000
    return m % 1 === 0 ? `${m.toFixed(0)}M` : `${m.toFixed(1)}M`
  }

  if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}K`
  }

  return String(price)
}
