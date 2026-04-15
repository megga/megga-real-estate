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
 */
export function formatCHF(amount: number): string {
  const formatted = amount
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'")
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
 */
export function formatRent(amount: number): string {
  return `${formatCHF(amount)}/mois`
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
