// Référence de loyer marché — fonctions PURES (zéro I/O, zéro dépendance Deno).
//
// Réutilisé par l'edge function matching-engine (Deno) ET par les tests vitest
// (Node) : aucun import runtime sauf slugify (lui-même pur). Mesure une POSITION
// vs marché (loyer/m² du bien vs médiane du segment), jamais une « valeur
// correcte ». Sous le seuil de comparables ou sans surface ⇒ null.
//
// Source des médianes = vue matérialisée public.market_rent_stats (Composant A),
// déjà filtrée à n_comparables >= 20 (honnêteté par construction).

import { slugify } from './matching-normalize.ts' // fonction PURE partagée (zéro I/O) ; évite un 2ᵉ slug divergent

// ─── Types ──────────────────────────────────────────────────────────────────

// RÉCONCILIATION : level ∈ exactement les 3 valeurs émises par la MV (A).
// 'canton_type' est gardé dans le type pour le rung terminal du fallback, mais
// la MV ne le matérialise PAS en v1 → ce rung ne résout jamais (retourne null).
export type RentLevel = 'npa_surf' | 'city_surf' | 'canton_surf' | 'canton_type'

export interface RentStatsRow {
  level: RentLevel
  canton: string
  type: string                  // 'apartment' | 'house' | 'villa'
  surface_band: string | null   // '<50'|'50-80'|'80-120'|'120+' ; null si canton_type
  postal_code: string | null    // renseigné seulement si level='npa_surf'
  city: string | null           // renseigné seulement si level='city_surf'
  median_loyer_m2: number
  p25_loyer_m2: number
  p75_loyer_m2: number
  n_comparables: number
}

export interface RentStatsIndex { byKey: Map<string, RentStatsRow> }

export interface RentSubject {
  canton: string | null
  type: string | null
  surface_m2: number | null
  loyer: number | null          // = COALESCE(current_price, price), résolu côté appelant
  postal_code?: string | null
  city?: string | null
}

export interface RentPosition {
  expected_loyer_m2: number     // = médiane du segment résolu
  p25: number
  p75: number
  n_comparables: number
  position_pct: number          // round((r-1)*100) ; négatif = sous le marché
  level: RentLevel              // cran de fallback effectivement utilisé
  frac: number                  // courbe position→[0,1] pour le matching
}

export interface PositionCurve {
  r_floor: number       // 0.70
  r_under: number       // 0.85
  r_market_lo: number   // 0.97
  r_market_hi: number   // 1.05
  r_over: number        // 1.25
  frac_floor: number    // 0.62
  frac_under: number    // 0.92  ← MAXIMUM de la courbe (hump à r_under, voir plus bas)
  frac_market: number   // 0.50
  frac_over: number     // 0.05
}

// ─── Helpers locaux (copiés verbatim de matching-normalize.ts) ───────────────
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}
function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)) }
function round2(n: number): number { return Math.round(n * 100) / 100 }
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0
  const t = clamp((x - x0) / (x1 - x0), 0, 1)
  return y0 + t * (y1 - y0)
}

// ─── surfaceBand — SOURCE DE VÉRITÉ UNIQUE (miroir octet du CASE SQL de A) ────
// DOIT correspondre OCTET POUR OCTET au CASE de la MV (§1) :
//   CASE WHEN surface_m2 < 50 THEN '<50'
//        WHEN surface_m2 < 80 THEN '50-80'
//        WHEN surface_m2 < 120 THEN '80-120'
//        ELSE '120+' END
// Edges fermés-à-gauche : 50 → '50-80', 80 → '80-120', 120 → '120+'.
export const SURFACE_BAND_EDGES: readonly [number, number, number] = [50, 80, 120]
export function surfaceBand(surface_m2: number): string {
  const [a, b, c] = SURFACE_BAND_EDGES
  if (surface_m2 < a) return '<50'
  if (surface_m2 < b) return '50-80'
  if (surface_m2 < c) return '80-120'
  return '120+'
}

// ─── Index des stats : clé préfixée par level (anti-collision entre niveaux) ──
//   npa_surf   : 'npa_surf|<CANTON>|<type>|<band>|<postal_code>'
//   city_surf  : 'city_surf|<CANTON>|<type>|<band>|<city_slug>'   (dormant v1)
//   canton_surf: 'canton_surf|<CANTON>|<type>|<band>'
//   canton_type: 'canton_type|<CANTON>|<type>'                    (jamais matérialisé v1)
function rentKey(level: RentLevel, canton: string, type: string,
                 band: string | null, geo: string | null): string {
  const C = (canton || '').toUpperCase().trim()
  const T = (type || '').toLowerCase().trim()
  const B = (band || '').toLowerCase().trim()
  switch (level) {
    case 'npa_surf':    return `npa_surf|${C}|${T}|${B}|${(geo || '').toLowerCase().trim()}`
    case 'city_surf':   return `city_surf|${C}|${T}|${B}|${slugify(geo || '')}`
    case 'canton_surf': return `canton_surf|${C}|${T}|${B}`
    case 'canton_type': return `canton_type|${C}|${T}`
  }
}

export function buildRentStatsIndex(rows: RentStatsRow[]): RentStatsIndex {
  const byKey = new Map<string, RentStatsRow>()
  for (const r of rows ?? []) {
    if (!r || !r.canton || !r.type) continue
    const geo = r.level === 'npa_surf' ? r.postal_code
              : r.level === 'city_surf' ? r.city
              : null
    const k = rentKey(r.level, r.canton, r.type, r.surface_band, geo)
    if (!byKey.has(k)) byKey.set(k, r) // 1 ligne/clé garantie par l'index unique MV
  }
  return { byKey }
}

// ─── positionFrac — la courbe (hump NON-MONOTONE par design, bornée, plafond < 1.0) ──
export const DEFAULT_POSITION_CURVE: PositionCurve = {
  r_floor: 0.70, r_under: 0.85, r_market_lo: 0.97, r_market_hi: 1.05, r_over: 1.25,
  frac_floor: 0.62, frac_under: 0.92, frac_market: 0.50, frac_over: 0.05,
}
// Piecewise-linéaire NON-MONOTONE PAR DESIGN (un « hump ») :
//   frac CULMINE à frac_under (0.92) à r = r_under = 0.85, PUIS REDESCEND.
//   Un loyer suspectement bas (r < r_under) est volontairement amorti vers
//   frac_floor (0.62) → garde anti-erreur-de-donnée (« position pas valeur » :
//   un loyer aberrant ne gagne jamais tout). Neutre 0.50 PILE au marché (r=1).
//   Ne JAMAIS « corriger » ce hump en rampe monotone : cela supprimerait la garde.
//   r <= r_floor                 → frac_floor (0.62)
//   r_floor..r_under             → frac_floor→frac_under (0.62→0.92)   [MONTE]
//   r_under..r_market_lo         → frac_under→frac_market (0.92→0.50)  [DESCEND]
//   r_market_lo..r_market_hi     → frac_market (0.50)
//   r_market_hi..r_over          → frac_market→frac_over (0.50→0.05)   [DESCEND]
//   r >= r_over                  → frac_over (0.05)
export function positionFrac(r: number, c: PositionCurve = DEFAULT_POSITION_CURVE): number {
  if (!Number.isFinite(r) || r <= 0) return c.frac_market
  if (r <= c.r_floor) return c.frac_floor
  if (r < c.r_under)      return lerp(r, c.r_floor, c.r_under, c.frac_floor, c.frac_under)
  if (r < c.r_market_lo)  return lerp(r, c.r_under, c.r_market_lo, c.frac_under, c.frac_market)
  if (r <= c.r_market_hi) return c.frac_market
  if (r < c.r_over)       return lerp(r, c.r_market_hi, c.r_over, c.frac_market, c.frac_over)
  return c.frac_over
}

// ─── rentPosition — résolution (fallback descendant) + arithmétique ──────────
export function rentPosition(
  subject: RentSubject,
  index: RentStatsIndex,
  curve: PositionCurve = DEFAULT_POSITION_CURVE,
): RentPosition | null {
  const surf = numOrNull(subject.surface_m2)
  const loyer = numOrNull(subject.loyer)
  const canton = subject.canton ? String(subject.canton).toUpperCase().trim() : null
  const type = subject.type ? String(subject.type).toLowerCase().trim() : null
  if (surf == null || surf <= 0) return null
  if (loyer == null || loyer <= 0) return null
  if (!canton || !type) return null

  const band = surfaceBand(surf)
  // Fallback DESCENDANT, s'arrête au 1er cran présent (donc déjà n≥20).
  const candidates: Array<[RentLevel, string | null]> = [
    ['npa_surf', subject.postal_code ?? null],
    ['city_surf', subject.city ?? null],
    ['canton_surf', null],
    ['canton_type', null],
  ]
  let hit: RentStatsRow | null = null
  let hitLevel: RentLevel | null = null
  for (const [level, geo] of candidates) {
    if ((level === 'npa_surf' || level === 'city_surf') && !geo) continue
    const b = level === 'canton_type' ? null : band
    const row = index.byKey.get(rentKey(level, canton, type, b, geo))
    if (row) { hit = row; hitLevel = level; break }
  }
  if (!hit || !hitLevel) return null

  const median = numOrNull(hit.median_loyer_m2)
  if (median == null || median <= 0) return null // div-by-zero défensif
  const subjectLoyerM2 = loyer / surf
  const r = subjectLoyerM2 / median
  return {
    expected_loyer_m2: round2(median),
    p25: round2(numOrNull(hit.p25_loyer_m2) ?? median),
    p75: round2(numOrNull(hit.p75_loyer_m2) ?? median),
    n_comparables: hit.n_comparables,
    position_pct: Math.round((r - 1) * 100) || 0, // `|| 0` normalise le -0 (round d'un négatif minuscule à r≈1) en +0
    level: hitLevel,
    frac: positionFrac(r, curve),
  }
}

// ─── buildRentReasonSuffix — raison FR, compliance-safe (PROPRIÉTAIRE = ce module) ──
// SUFFIXE à concaténer au budget.detail existant (jamais une 6ᵉ clé reasons).
// « position / marché du secteur / n comparables », jamais « valeur » ni « garanti ».
export function buildRentReasonSuffix(pos: RentPosition | null): string {
  if (!pos) return ''
  const pct = Math.abs(pos.position_pct)
  const n = pos.n_comparables
  const plural = n > 1 ? 's' : ''
  if (pct <= 3) return ` · au prix du marché du secteur (sur ${n} comparable${plural})`
  if (pos.position_pct < 0) return ` · ~${pct}% sous le marché du secteur (sur ${n} comparable${plural})`
  return ` · ~${pct}% au-dessus du marché du secteur (sur ${n} comparable${plural})`
}
