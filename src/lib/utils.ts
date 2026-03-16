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
