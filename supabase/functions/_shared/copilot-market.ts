// Statistiques de marché DÉTERMINISTES pour l'outil get_market_stats — module
// PUR (zéro I/O, zéro Deno), testable vitest. DeepSeek ne calcule JAMAIS un
// chiffre de marché : tout est agrégé ici, il ne fait que rédiger.
//
// Honnêteté par construction (même doctrine que market_rent_stats) : sous
// MIN_COMPARABLES on ne publie pas de médiane locale — on retombe sur le cran
// géographique supérieur, et on dit toujours le n et le niveau utilisés.

export const MIN_COMPARABLES = 20

/** Ligne candidate côté vente (sortie de match_candidate_listings). */
export interface SaleCandidateRow {
  price: number | null
  current_price: number | null
  city: string | null
  rooms: number | null
  surface_m2: number | null
}

export interface SaleStats {
  level: 'city' | 'canton'
  n: number
  median_price_m2: number
  p25_price_m2: number
  p75_price_m2: number
}

export interface SalePosition {
  position_pct: number // >0 = au-dessus du marché
  subject_price_m2: number
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

/** Percentile linéaire sur tableau trié (p ∈ [0,1]). */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo])
}

const round0 = (n: number) => Math.round(n)

function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Prix/m² d'une ligne, null si inexploitable (garde anti-données aberrantes). */
export function salePriceM2(row: SaleCandidateRow): number | null {
  const price = num(row.current_price) ?? num(row.price)
  const surf = num(row.surface_m2)
  if (price == null || surf == null || surf < 8 || surf > 2000) return null
  if (price < 50_000 || price > 100_000_000) return null
  const ppm2 = price / surf
  // Fenêtre large de plausibilité suisse (écarte les erreurs de saisie).
  if (ppm2 < 500 || ppm2 > 60_000) return null
  return ppm2
}

/** Stats vente : essaie la ville demandée (n >= MIN_COMPARABLES), sinon retombe
 *  au canton (l'échantillon = toutes les lignes reçues). null si même le canton
 *  est sous le seuil — l'appelant dit alors « échantillon insuffisant ». */
export function buildSaleStats(rows: SaleCandidateRow[], city?: string | null): SaleStats | null {
  const all = rows.map(salePriceM2).filter((v): v is number => v != null)
  const cityNorm = norm(city)
  if (cityNorm) {
    const local = rows
      .filter((r) => norm(r.city) === cityNorm)
      .map(salePriceM2)
      .filter((v): v is number => v != null)
    if (local.length >= MIN_COMPARABLES) {
      const sorted = [...local].sort((a, b) => a - b)
      return {
        level: 'city', n: sorted.length,
        median_price_m2: round0(percentile(sorted, 0.5)),
        p25_price_m2: round0(percentile(sorted, 0.25)),
        p75_price_m2: round0(percentile(sorted, 0.75)),
      }
    }
  }
  if (all.length >= MIN_COMPARABLES) {
    const sorted = [...all].sort((a, b) => a - b)
    return {
      level: 'canton', n: sorted.length,
      median_price_m2: round0(percentile(sorted, 0.5)),
      p25_price_m2: round0(percentile(sorted, 0.25)),
      p75_price_m2: round0(percentile(sorted, 0.75)),
    }
  }
  return null
}

/** Position d'un bien vs médiane (vente comme locatif) : arithmétique simple,
 *  aucun jugement — « position, pas valeur ». */
export function salePosition(stats: SaleStats, amount: number | null | undefined, surface: number | null | undefined): SalePosition | null {
  const a = num(amount)
  const s = num(surface)
  if (a == null || s == null || a <= 0 || s <= 0 || stats.median_price_m2 <= 0) return null
  const subject = a / s
  return {
    subject_price_m2: round0(subject),
    position_pct: Math.round((subject / stats.median_price_m2 - 1) * 100) || 0,
  }
}
