// Matching — fonctions PURES (zéro I/O, zéro dépendance Deno).
//
// Réutilisé par l'edge function matching-engine (Deno) ET par les tests vitest
// (Node). Donc : un seul import (rent-reference, module pur du même dossier),
// aucun std Deno ni supabase, aucune API runtime.
// Tout est déterministe et testable hors base — conforme « estimation » + LPD
// (aucune PII vers un LLM, c'est de l'arithmétique).
//
// Conception : Direction A (durcir). Deux étages :
//   1. pré-filtre DUR en SQL (match_candidate_listings) — hors de ce fichier ;
//   2. scoring SOFT continu 0-100 ci-dessous, sur le sous-ensemble pré-filtré.
//
// Le SEUL filtre dur non-récupérable est transaction_type (un loyer n'est
// jamais une vente). inferTransactionType() le résout même quand la recherche
// ne le précise pas (3 recherches sur 4 en prod).

import { buildRentReasonSuffix } from './rent-reference.ts'
import type { RentPosition } from './rent-reference.ts'

// ─── Cantons suisses ───────────────────────────────────────────────────────
export const SWISS_CANTONS: ReadonlySet<string> = new Set([
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO', 'ZH',
  'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG',
  'GR', 'TI',
])

// Noms de cantons (et capitales canton=ville sans ambiguïté) → code. Volontairement
// limité aux libellés NON ambigus : une ville pure (Carouge, Lausanne, Lugano…)
// NE dérive PAS de canton (elle reste un token de ville pour le score lexical),
// pour ne pas sur-filtrer en dur. Voir spec : canton dur uniquement sur preuve nette.
const CANTON_BY_NAME: Readonly<Record<string, string>> = {
  geneve: 'GE', geneva: 'GE', genf: 'GE',
  vaud: 'VD', waadt: 'VD',
  valais: 'VS', wallis: 'VS',
  neuchatel: 'NE',
  fribourg: 'FR', freiburg: 'FR',
  berne: 'BE', bern: 'BE',
  jura: 'JU',
  bale: 'BS', basel: 'BS', 'bale-ville': 'BS', 'bale-campagne': 'BL',
  argovie: 'AG', aargau: 'AG',
  soleure: 'SO', solothurn: 'SO',
  zurich: 'ZH', zuerich: 'ZH',
  lucerne: 'LU', luzern: 'LU',
  zoug: 'ZG', zug: 'ZG',
  schwyz: 'SZ',
  nidwald: 'NW', obwald: 'OW', uri: 'UR',
  glaris: 'GL', glarus: 'GL',
  schaffhouse: 'SH', schaffhausen: 'SH',
  thurgovie: 'TG', thurgau: 'TG',
  'saint-gall': 'SG', 'st-gall': 'SG',
  grisons: 'GR', graubunden: 'GR',
  tessin: 'TI', ticino: 'TI',
}

// ─── slugify : minuscule + sans accents + tirets ────────────────────────────
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Inférence transaction_type ─────────────────────────────────────────────
// criteria.transaction_type explicite prime ; sinon on infère du budget :
// un montant >= 50 000 = prix de vente (buy), sinon = loyer mensuel (rent).
// Pas de budget du tout => 'rent' (pool 34 693 rent vs 12 buy : maximise le
// rappel utile sans inventer d'intention d'achat).
export function inferTransactionType(criteria: Record<string, unknown> | null | undefined): 'buy' | 'rent' {
  const tx = criteria?.transaction_type
  if (tx === 'buy' || tx === 'rent') return tx
  const probe = numOrNull(criteria?.budget_max) ?? numOrNull(criteria?.budget_min)
  if (probe == null) return 'rent'
  return probe >= 50000 ? 'buy' : 'rent'
}

// ─── Normalisation des zones[] (texte libre) → cantons durs + villes soft ────
export interface NormalizedZones {
  cantons: string[] // codes canton dérivés de façon SÛRE (filtre dur)
  cities: string[] // slugs de villes (score lexical soft)
}
export function normalizeZones(zones: unknown): NormalizedZones {
  const cantons = new Set<string>()
  const cities = new Set<string>()
  const list = Array.isArray(zones) ? zones : []
  for (const raw of list) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const code = raw.replace(/[^a-zA-Z]/g, '').toUpperCase()
    if (code.length === 2 && SWISS_CANTONS.has(code)) {
      cantons.add(code)
      continue
    }
    const slug = slugify(raw)
    if (CANTON_BY_NAME[slug]) {
      cantons.add(CANTON_BY_NAME[slug])
      // un nom de canton est aussi une zone lexicale (ex « Genève » = ville centre)
      cities.add(slug)
    } else if (slug) {
      cities.add(slug)
    }
  }
  return { cantons: [...cantons], cities: [...cities] }
}

// ─── Tokens de features (gère array OU objet {Parking:true}) ────────────────
export function featTokens(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((f): f is string => typeof f === 'string').map(slugify).filter(Boolean)
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => slugify(k))
      .filter(Boolean)
  }
  return []
}

// ─── Familles de types (équivalences souples) ───────────────────────────────
const TYPE_FAMILY: Readonly<Record<string, string>> = {
  apartment: 'apartment', studio: 'apartment', attic: 'apartment', attique: 'apartment',
  duplex: 'apartment', loft: 'apartment', penthouse: 'apartment',
  house: 'house', villa: 'house', chalet: 'house', maison: 'house',
  commercial: 'commercial', office: 'commercial', bureau: 'commercial',
  parking: 'parking', garage: 'parking',
  land: 'land', terrain: 'land',
}
function typeFamily(t: string): string {
  const s = slugify(t)
  return TYPE_FAMILY[s] ?? s
}

// ─── Config de scoring (poids/seuil), surchargée par app_config ─────────────
export interface ScoringConfig {
  weights: { price: number; zone: number; type: number; rooms: number; surface: number; features: number; pricePosition: number; priceDrop: number }
  threshold: number
  priceOverTolerance: number // 0.15 = 0 pt à +15% au-dessus du budget max
  surfaceDeficitTolerance: number // 0.20 = 0 pt à -20% sous la surface min
  version: number
}
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10, pricePosition: 7, priceDrop: 5 }, // 100 = barème redistribué ; 7 et 5 = BONUS additifs (hors redistribution)
  threshold: 55,
  priceOverTolerance: 0.15,
  surfaceDeficitTolerance: 0.20,
  version: 4,
}
export function parseScoringConfig(text: string | null | undefined): ScoringConfig {
  if (!text) return DEFAULT_SCORING_CONFIG
  try {
    const raw = JSON.parse(text) as Partial<ScoringConfig>
    return {
      weights: { ...DEFAULT_SCORING_CONFIG.weights, ...(raw.weights ?? {}) },
      threshold: numOrNull(raw.threshold) ?? DEFAULT_SCORING_CONFIG.threshold,
      priceOverTolerance: numOrNull(raw.priceOverTolerance) ?? DEFAULT_SCORING_CONFIG.priceOverTolerance,
      surfaceDeficitTolerance: numOrNull(raw.surfaceDeficitTolerance) ?? DEFAULT_SCORING_CONFIG.surfaceDeficitTolerance,
      version: numOrNull(raw.version) ?? DEFAULT_SCORING_CONFIG.version,
    }
  } catch {
    return DEFAULT_SCORING_CONFIG // config TEXT mal formée → défauts (jamais de crash)
  }
}

// ─── Résultat (contrat figé : EXACTEMENT 5 clés reasons, lues par l'Atelier) ─
export interface ReasonAxis { match: boolean; score: number; detail: string }
export interface MatchReasons {
  budget: ReasonAxis
  zone: ReasonAxis
  type: ReasonAxis
  rooms: ReasonAxis // = pièces + surface fusionnés (REASON_LABELS « Pièces & surface »)
  features: ReasonAxis
}
export interface ScoreResult { total: number; reasons: MatchReasons }

// listing : current_price?/price/type/canton/city/rooms/surface_m2/features
// criteria : budget_min/max/zones/type/rooms_min/max/surface_min/features
export function calculateScoreV2(
  listing: Record<string, unknown>,
  criteria: Record<string, unknown> | null | undefined,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
  rentRef: RentPosition | null = null, // précalculé par l'edge, zéro I/O ici
): ScoreResult {
  if (!criteria) return { total: 0, reasons: emptyReasons() }
  const W = cfg.weights

  const amount = numOrNull(listing.current_price) ?? numOrNull(listing.price) ?? 0
  const budgetMin = numOrNull(criteria.budget_min)
  const budgetMax = numOrNull(criteria.budget_max)
  const zones = normalizeZones(criteria.zones)
  const wantType = typeof criteria.type === 'string' && criteria.type ? typeFamily(criteria.type) : null
  const roomsMin = numOrNull(criteria.rooms_min)
  const roomsMax = numOrNull(criteria.rooms_max)
  const surfaceMin = numOrNull(criteria.surface_min)
  const wantFeats = featTokens(criteria.features)

  // ── PRIX : actif si au moins une borne de budget ──
  const price = scorePrice(amount, budgetMin, budgetMax, cfg.priceOverTolerance)

  // ── ZONE : actif si au moins une zone ──
  const zone = scoreZone(listing, zones)

  // ── TYPE : actif si un type est demandé ──
  const type = scoreType(listing.type, wantType)

  // ── PIÈCES & SURFACE (deux axes, fusionnés dans la reason « rooms ») ──
  const rooms = scoreRooms(numOrNull(listing.rooms), roomsMin, roomsMax)
  const surface = scoreSurface(numOrNull(listing.surface_m2), surfaceMin, cfg.surfaceDeficitTolerance)

  // ── FEATURES : actif si des features sont demandées (corrige le +10 par défaut) ──
  const features = scoreFeatures(featTokens(listing.features), wantFeats)

  // ── Redistribution : les axes inactifs cèdent leur poids aux actifs ──
  const axes: { active: boolean; w: number }[] = [
    { active: price.active, w: W.price },
    { active: zone.active, w: W.zone },
    { active: type.active, w: W.type },
    { active: rooms.active, w: W.rooms },
    { active: surface.active, w: W.surface },
    { active: features.active, w: W.features },
  ]
  const liveWeight = axes.reduce((s, a) => s + (a.active ? a.w : 0), 0)
  const totalWeight = axes.reduce((s, a) => s + a.w, 0)
  const scale = liveWeight > 0 ? totalWeight / liveWeight : 0

  const pts = (axis: { active: boolean; frac: number }, w: number): number =>
    axis.active ? axis.frac * w * scale : 0

  const priceP = pts(price, W.price)
  const zoneP = pts(zone, W.zone)
  const typeP = pts(type, W.type)
  const roomsP = pts(rooms, W.rooms)
  const surfaceP = pts(surface, W.surface)
  const featP = pts(features, W.features)

  // ─── PRIX vs MARCHÉ (BONUS additif, hors redistribution) ─────────────────
  // pricePosition n'entre PAS dans axes[]/totalWeight (sinon +7% sur 100% des
  // candidats inactifs — régression prouvée). Bonus qui s'ajoute au sous-total
  // 6 axes UNIQUEMENT quand rentRef est présent ; rentRef.frac est déjà calculé
  // par rentPosition() avec la même courbe → réutilisé tel quel. clamp borne à 100.
  const pricePosP = rentRef ? clamp(rentRef.frac, 0, 1) * W.pricePosition : 0

  // ─── PRIX BAISSÉ (BONUS additif, hors redistribution — même pattern) ──────
  // Signal « vendeur potentiellement motivé » produit par le trigger
  // ra_price_status (baisses RealAdvisor, vente). Baisse réelle ≥2% requise
  // (anti-bruit arrondi/devise) ; bonus plein à ≥10% de baisse, linéaire entre
  // les deux. Champs servis par match_candidate_listings ; absents (properties
  // internes, vieux appels) ⇒ 0 — dégradation silencieuse, barème 100 inchangé.
  const firstSeen = numOrNull(listing.price_at_first_seen)
  const dropFrac =
    listing.status === 'price_reduced' && firstSeen != null && firstSeen > 0 && amount > 0 && amount < firstSeen
      ? 1 - amount / firstSeen
      : 0
  const priceDropP = dropFrac >= 0.02 ? clamp(dropFrac / 0.10, 0, 1) * W.priceDrop : 0

  const total = clamp(Math.round(priceP + zoneP + typeP + roomsP + surfaceP + featP + pricePosP + priceDropP), 0, 100)

  // reason « rooms » = pièces + surface fusionnés (libellé Atelier « Pièces & surface »)
  const roomsSurfP = roomsP + surfaceP
  const roomsActiveAxes = [rooms, surface].filter((a) => a.active)
  const roomsSurfActive = roomsActiveAxes.length > 0
  // moyenne du frac sur les SEULS axes actifs (sinon un bon match unilatéral est sous-évalué)
  const roomsFrac = roomsSurfActive ? roomsActiveAxes.reduce((s, a) => s + a.frac, 0) / roomsActiveAxes.length : 0
  const roomsDetail = [rooms.detail, surface.detail].filter(Boolean).join(' · ') || 'Aucun critère'

  const reasons: MatchReasons = {
    budget: axisReason(price, priceP),
    zone: axisReason(zone, zoneP),
    type: axisReason(type, typeP),
    rooms: { match: roomsSurfActive && roomsFrac >= 0.5, score: Math.round(roomsSurfP), detail: roomsDetail },
    features: axisReason(features, featP),
  }
  // Position marché : appendée au détail BUDGET (jamais une 6ᵉ clé — contrat figé).
  if (rentRef) {
    const suffix = buildRentReasonSuffix(rentRef)
    if (suffix) reasons.budget = { ...reasons.budget, detail: `${reasons.budget.detail}${suffix}` }
  }
  // Prix baissé : même règle — suffixe sur budget.detail, jamais une 6ᵉ clé.
  if (priceDropP > 0) {
    reasons.budget = { ...reasons.budget, detail: `${reasons.budget.detail} · Prix baissé de ${Math.round(dropFrac * 100)}%` }
  }
  return { total, reasons }
}

// ─── Axes (chacun renvoie {active, frac 0-1, detail}) ───────────────────────
interface Axis { active: boolean; frac: number; detail: string }

function scorePrice(amount: number, min: number | null, max: number | null, overTol: number): Axis {
  if (min == null && max == null) return { active: false, frac: 0, detail: '' }
  const lo = min ?? 0
  const hi = max ?? Infinity
  if (amount <= 0) return { active: true, frac: 0, detail: 'Prix indisponible' }
  if (amount >= lo && amount <= hi) return { active: true, frac: 1, detail: 'Dans le budget' }
  if (amount > hi && hi !== Infinity) {
    const over = amount / hi - 1
    const frac = Math.max(0, 1 - over / overTol)
    return { active: true, frac, detail: `${Math.round(over * 100)}% au-dessus du budget` }
  }
  // sous le minimum : pénalité douce
  const frac = lo > 0 ? 0.7 + 0.3 * clamp(amount / lo, 0, 1) : 0.7
  return { active: true, frac, detail: 'Sous le budget minimum' }
}

function scoreZone(listing: Record<string, unknown>, zones: NormalizedZones): Axis {
  if (zones.cantons.length === 0 && zones.cities.length === 0) return { active: false, frac: 0, detail: '' }
  const city = slugify(String(listing.city ?? ''))
  const canton = String(listing.canton ?? '').toUpperCase()
  // exact, ou sous-chaîne SEULEMENT sur slugs assez longs (évite les faux positifs
  // de préfixes courts ; les vraies communes composées 'grand-/petit-/le-' passent)
  if (city && zones.cities.some((z) => z === city || (z.length >= 4 && city.length >= 4 && (z.includes(city) || city.includes(z))))) {
    return { active: true, frac: 1, detail: `${listing.city} correspond` }
  }
  if (canton && zones.cantons.includes(canton)) {
    return { active: true, frac: 0.6, detail: `Canton ${canton} correspond` }
  }
  return { active: true, frac: 0, detail: 'Hors zone' }
}

function scoreType(listingType: unknown, wantFamily: string | null): Axis {
  if (!wantFamily) return { active: false, frac: 0, detail: '' }
  const fam = typeFamily(String(listingType ?? ''))
  if (fam === wantFamily) return { active: true, frac: 1, detail: String(listingType ?? '') || 'Type correspond' }
  return { active: true, frac: 0, detail: `${listingType ?? '?'} ≠ ${wantFamily}` }
}

function scoreRooms(rooms: number | null, min: number | null, max: number | null): Axis {
  if (min == null && max == null) return { active: false, frac: 0, detail: '' }
  if (rooms == null) return { active: true, frac: 0, detail: 'Pièces inconnues' }
  const lo = min ?? 0
  const hi = max ?? Infinity
  if (rooms >= lo && rooms <= hi) return { active: true, frac: 1, detail: `${fmtNum(rooms)} pièces` }
  const gap = rooms < lo ? lo - rooms : rooms - hi
  const frac = Math.max(0, 1 - gap / 2) // -50% par demi-pièce hors bande (pièces CH en .5)
  return { active: true, frac, detail: `${fmtNum(rooms)} pièces` }
}

function scoreSurface(surface: number | null, min: number | null, deficitTol: number): Axis {
  if (min == null) return { active: false, frac: 0, detail: '' }
  if (surface == null) return { active: true, frac: 0, detail: 'Surface inconnue' }
  if (surface >= min) return { active: true, frac: 1, detail: `${fmtNum(surface)} m²` }
  const deficit = min > 0 ? 1 - surface / min : 1
  const frac = Math.max(0, 1 - deficit / deficitTol)
  return { active: true, frac, detail: `${fmtNum(surface)} m²` }
}

function scoreFeatures(have: string[], want: string[]): Axis {
  if (want.length === 0) return { active: false, frac: 0, detail: '' } // corrige le +10 par défaut
  const hits = want.filter((w) => have.some((h) => h === w || h.includes(w) || w.includes(h)))
  const frac = hits.length / want.length
  return { active: true, frac, detail: `${hits.length}/${want.length} critères` }
}

// ─── utilitaires ─────────────────────────────────────────────────────────
function axisReason(axis: Axis, points: number): ReasonAxis {
  if (!axis.active) return { match: false, score: 0, detail: axis.detail || '—' }
  return { match: axis.frac >= 0.5, score: Math.round(points), detail: axis.detail }
}
function emptyReasons(): MatchReasons {
  const z: ReasonAxis = { match: false, score: 0, detail: '—' }
  return { budget: { ...z }, zone: { ...z }, type: { ...z }, rooms: { ...z }, features: { ...z } }
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}
