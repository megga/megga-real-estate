// Statistiques de marché DÉTERMINISTES pour l'outil get_market_stats — module
// PUR (zéro I/O, zéro Deno), testable vitest. DeepSeek ne calcule JAMAIS un
// chiffre de marché : tout est agrégé en base, il ne fait que rédiger.
//
// Honnêteté par construction (même doctrine que market_rent_stats) : sous
// MIN_COMPARABLES on ne publie pas de médiane locale — on retombe sur le cran
// géographique supérieur, et on dit toujours le n et le niveau utilisés.
//
// ⚠️ L'agrégation elle-même vit EN SQL (RPC market_sale_stats), pas ici. Elle y
// est passée le 20 juillet 2026 : la version TS agrégeait les 400 lignes servies
// par match_candidate_listings, RPC triée `quality_score DESC, prix ASC`. Le
// quality_score étant saturé (36 222 annonces à 100), cette troncature ne gardait
// que les moins chères — jusqu'à −39,5 % sur la médiane publiée (Tessin maisons,
// mesuré en prod). Ce module ne fait plus que CHOISIR le cran géographique et
// positionner un bien ; agréger un échantillon ici serait rouvrir le bug.

export const MIN_COMPARABLES = 20

/** Une ligne de market_sale_stats : un cran géographique déjà agrégé en SQL. */
export interface SaleStatsRow {
  level: string
  n: number
  median_price_m2: number | string | null
  p25_price_m2: number | string | null
  p75_price_m2: number | string | null
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

/** Une ligne agrégée est publiable si elle tient le seuil ET porte une médiane. */
function usable(row: SaleStatsRow | undefined): SaleStats | null {
  if (!row || row.n < MIN_COMPARABLES) return null
  const median = num(row.median_price_m2)
  const p25 = num(row.p25_price_m2)
  const p75 = num(row.p75_price_m2)
  if (median == null || p25 == null || p75 == null || median <= 0) return null
  return {
    level: row.level === 'city' ? 'city' : 'canton',
    n: row.n,
    median_price_m2: median,
    p25_price_m2: p25,
    p75_price_m2: p75,
  }
}

/** Choisit le cran à publier : la ville demandée si elle tient MIN_COMPARABLES,
 *  sinon le canton. null si même le canton est sous le seuil — l'appelant dit
 *  alors « échantillon insuffisant » et ne cite AUCUN chiffre.
 *
 *  Les deux crans arrivent déjà agrégés sur leur population COMPLÈTE : le choix
 *  du cran ne change donc que la géographie, jamais la représentativité. */
export function pickSaleStats(rows: SaleStatsRow[]): SaleStats | null {
  return usable(rows.find((r) => r.level === 'city'))
      ?? usable(rows.find((r) => r.level === 'canton'))
}

/** Position d'un bien vs médiane (vente comme locatif) : arithmétique simple,
 *  aucun jugement — « position, pas valeur ». */
export function salePosition(stats: SaleStats, amount: number | null | undefined, surface: number | null | undefined): SalePosition | null {
  const a = num(amount)
  const s = num(surface)
  if (a == null || s == null || a <= 0 || s <= 0 || stats.median_price_m2 <= 0) return null
  const subject = a / s
  return {
    subject_price_m2: Math.round(subject),
    position_pct: Math.round((subject / stats.median_price_m2 - 1) * 100) || 0,
  }
}
