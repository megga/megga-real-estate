// Refonte Contacts — pont critères de recherche ↔ matching.
// La donnée reine du matching vit dans `contacts.search_criteria` (jsonb).
// Forme canonique (échantillons réels + matching-engine) : SNAKE_CASE anglais
//   { type, transaction_type: 'rent'|'buy', zones[], budget_min/max, rooms_min/max,
//     surface_min/max, features[] }
// L'UI (design handoff) parle français (appartement, location, cantons GE…) : ce
// module convertit dans les deux sens pour que l'écriture déclenche bien le pont
// contacts→client_searches→matching-engine, et que la lecture réhydrate l'UI.

import type { SearchCriteria } from '@/types/contact'

// ─── Type de bien : UI (FR) ↔ DB/matching (EN, singulier) ──────────────
export const PROP_TYPE_FR_TO_EN: Record<string, string> = {
  appartement: 'apartment',
  maison: 'house',
  villa: 'villa',
  terrain: 'land',
  commercial: 'commercial',
}
export const PROP_TYPE_EN_TO_FR: Record<string, string> = {
  apartment: 'appartement',
  house: 'maison',
  villa: 'villa',
  land: 'terrain',
  commercial: 'commercial',
}

export type UiTransaction = 'vente' | 'location'

export interface CriteriaInput {
  transaction: UiTransaction
  types: string[] // ids FR : appartement / maison / terrain / commercial…
  cantons: string[] // codes cantons : GE / VD…
  cities?: string[] // villes libres
  budgetMin?: number | null
  budgetMax?: number | null
  roomsMin?: number | null
  areaMin?: number | null
  mustHave?: string[] // libellés d'indispensables (features)
}

/**
 * Construit le `search_criteria` (snake_case EN) écrit en base. On n'inclut que
 * les clés porteuses de signal : le pont DB ignore `{}`/null, donc un contact
 * sans critère réel ne crée pas de `client_searches` (et ne matche pas). Le
 * `transaction_type` seul ne suffit pas à rendre l'objet « signifiant ».
 */
export function buildSearchCriteria(i: CriteriaInput): SearchCriteria | null {
  const c: SearchCriteria = {
    transaction_type: i.transaction === 'location' ? 'rent' : 'buy',
  }
  const firstType = i.types?.[0]
  if (firstType) c.type = PROP_TYPE_FR_TO_EN[firstType] ?? firstType
  const zones = [...(i.cantons ?? []), ...(i.cities ?? [])].filter(Boolean)
  if (zones.length) c.zones = zones
  if (i.budgetMin != null && i.budgetMin !== 0) c.budget_min = i.budgetMin
  if (i.budgetMax != null && i.budgetMax !== 0) c.budget_max = i.budgetMax
  if (i.roomsMin != null && i.roomsMin !== 0) c.rooms_min = i.roomsMin
  if (i.areaMin != null && i.areaMin !== 0) c.surface_min = i.areaMin
  if (i.mustHave?.length) c.features = i.mustHave

  const meaningful =
    c.type || c.zones || c.budget_min || c.budget_max || c.rooms_min || c.surface_min || c.features
  return meaningful ? c : null
}

// Codes cantons suisses (2 lettres majuscules) pour séparer zones cantons ↔ villes.
const CANTON_CODES = new Set([
  'GE', 'VD', 'VS', 'NE', 'FR', 'JU', 'BE', 'ZH', 'LU', 'ZG', 'SO', 'BS', 'BL',
  'AG', 'SZ', 'UR', 'OW', 'NW', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
])

/** Vrai si `z` est un code canton suisse (2 lettres), pour trier zones cantons ↔ villes. */
export function isCantonCode(z: string): boolean {
  return CANTON_CODES.has(z.trim().toUpperCase())
}

/** Sépare le tableau `zones` (mélange villes + codes cantons) en deux listes. */
export function splitZones(zones: string[] | undefined): { cantons: string[]; cities: string[] } {
  const cantons: string[] = []
  const cities: string[] = []
  for (const z of zones ?? []) {
    if (!z) continue
    if (isCantonCode(z)) cantons.push(z.trim().toUpperCase())
    else cities.push(z)
  }
  return { cantons, cities }
}

/** Forme UI dérivée d'un `search_criteria` DB (pour édition inline de la fiche). */
export function parseSearchCriteria(sc: SearchCriteria | null | undefined): CriteriaInput {
  const { cantons, cities } = splitZones(sc?.zones)
  const enType = sc?.type
  return {
    transaction: sc?.transaction_type === 'rent' ? 'location' : 'vente',
    types: enType ? [PROP_TYPE_EN_TO_FR[enType] ?? enType] : [],
    cantons,
    cities,
    budgetMin: sc?.budget_min ?? null,
    budgetMax: sc?.budget_max ?? null,
    roomsMin: sc?.rooms_min ?? null,
    areaMin: sc?.surface_min ?? null,
    mustHave: sc?.features ?? [],
  }
}
