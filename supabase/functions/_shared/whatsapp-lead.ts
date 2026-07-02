// Phase 4B — logique PURE de qualification de lead. Aucun I/O.
// Les entités viennent de la compréhension (DeepSeek) ; ici on normalise vers le
// schéma client_searches (matching) et on calcule les champs manquants.

export interface LeadCriteria {
  transaction_type?: 'rent' | 'buy'
  type?: string            // EN : apartment / house / villa / …
  zones?: string[]
  budget_min?: number
  budget_max?: number
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  features?: string[]
}

export interface LeadContactInfo { phone?: string | null; email?: string | null }

export const TYPE_FR_EN: Record<string, string> = {
  appartement: 'apartment', appart: 'apartment', studio: 'apartment', loft: 'apartment',
  maison: 'house', villa: 'villa', terrain: 'land', immeuble: 'building',
  commercial: 'commercial', bureau: 'office', local: 'commercial', parking: 'parking',
  'garde-meuble': 'storage', 'garde meuble': 'storage', depot: 'storage', dépôt: 'storage', box: 'storage',
}

// Types canoniques réellement présents dans market_listings.type (les 8 catégories
// du marché). 'building' n'y figure pas → on ne l'utilise jamais comme filtre.
const MARKET_TYPES = new Set(['apartment', 'house', 'villa', 'land', 'commercial', 'office', 'parking', 'storage'])

/** Type de bien (FR libre OU déjà canonique EN) → valeur `market_listings.type`, ou
 *  undefined si on ne sait pas mapper (le filtre est alors simplement omis). */
export function canonicalPropertyType(input: string | null | undefined): string | undefined {
  const k = (input ?? '').toLowerCase().trim()
  if (!k) return undefined
  const mapped = TYPE_FR_EN[k]
  if (mapped && MARKET_TYPES.has(mapped)) return mapped
  if (MARKET_TYPES.has(k)) return k // déjà canonique
  return undefined
}

const FEATURE_FR: Record<string, string> = {
  terrasse: 'Terrasse', balcon: 'Balcon', jardin: 'Jardin', parking: 'Parking',
  garage: 'Garage', cave: 'Cave', ascenseur: 'Ascenseur', piscine: 'Piscine', vue: 'Vue',
}

// Noms propres mal transcrits / variantes → forme canonique CH (clé = minuscules,
// tirets/apostrophes → espaces). Garantit que le matching cherche au bon endroit.
const ZONE_CANON: Record<string, string> = {
  carrouges: 'Carouge', carouges: 'Carouge', carouge: 'Carouge',
  geneve: 'Genève', 'eaux vives': 'Eaux-Vives', eauxvives: 'Eaux-Vives',
  plainpalais: 'Plainpalais', champel: 'Champel', servette: 'Servette',
  paquis: 'Pâquis', acacias: 'Acacias', jonction: 'Jonction', lancy: 'Lancy',
  onex: 'Onex', vernier: 'Vernier', meyrin: 'Meyrin', versoix: 'Versoix',
  cologny: 'Cologny', thonex: 'Thônex', 'chene bourg': 'Chêne-Bourg',
  'chene bougeries': 'Chêne-Bougeries', 'plan les ouates': 'Plan-les-Ouates', bernex: 'Bernex',
}

/** Normalise un nom de zone (corrige les coquilles STT connues, sinon renvoie tel quel). */
export function normalizeZone(z: string): string {
  const k = z.trim().toLowerCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim()
  return ZONE_CANON[k] ?? z.trim()
}

/** rent si location/loyer/mensuel ; buy si achat/vente ; sinon undefined. */
export function detectTransactionType(text: string | null | undefined): 'rent' | 'buy' | undefined {
  const t = (text ?? '').toLowerCase()
  if (/lou[ée]|louer|loyer|par\s*mois|\/\s*mois|location|mensuel/.test(t)) return 'rent'
  if (/achet|acqu[ée]r|achat|à\s*vendre|à\s*acheter/.test(t)) return 'buy'
  return undefined
}

/** Parse un montant ("3000", "1,2M", "1.2 million", "900'000", "CHF 720'000") → nombre.
 *  Le suffixe magnitude (M/k) n'est pris en compte que s'il SUIT immédiatement le nombre
 *  (évite que « 3000 par mois » devienne 3 milliards via le « m » de « mois »). */
export function parseAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return isFinite(v) ? v : undefined
  if (typeof v !== 'string') return undefined
  const s = v.toLowerCase().replace(/['’\s]/g, '')
  const m = s.match(/(\d+(?:[.,]\d+)?)(m(?:io|illion)?|k)?/)
  if (!m) return undefined
  const n = parseFloat(m[1].replace(',', '.'))
  if (!isFinite(n)) return undefined
  const mult = m[2]?.startsWith('m') ? 1_000_000 : m[2] === 'k' ? 1000 : 1
  return Math.round(n * mult)
}

/** Normalise les entités de la compréhension vers le schéma client_searches. */
export function mapCriteria(
  intent: string | null | undefined,
  entities: Record<string, unknown> | null | undefined,
  transcript: string | null | undefined,
): LeadCriteria {
  const e = entities ?? {}
  const c: LeadCriteria = {}

  if (intent === 'recherche_location') c.transaction_type = 'rent'
  else if (intent === 'recherche_achat') c.transaction_type = 'buy'
  else c.transaction_type = detectTransactionType(transcript)

  const typeFr = typeof e.type === 'string' ? e.type.toLowerCase().trim() : ''
  if (typeFr && TYPE_FR_EN[typeFr]) c.type = TYPE_FR_EN[typeFr]

  if (Array.isArray(e.zones)) {
    const zones = (e.zones as unknown[])
      .filter((z): z is string => typeof z === 'string' && z.trim().length > 0)
      .map(normalizeZone)
    if (zones.length) c.zones = zones
  }

  const budget = parseAmount(e.budget)
  if (budget !== undefined) c.budget_max = budget

  const rooms = typeof e.pieces === 'number' ? e.pieces : parseFloat(String(e.pieces ?? '').replace(',', '.'))
  if (isFinite(rooms) && rooms > 0) { c.rooms_min = rooms; c.rooms_max = rooms }

  const surface = parseAmount(e.surface)
  if (surface !== undefined && surface > 0) c.surface_min = surface

  const feats = new Set<string>()
  if (Array.isArray(e.features)) {
    for (const f of e.features as unknown[]) {
      if (typeof f === 'string' && FEATURE_FR[f.toLowerCase().trim()]) feats.add(FEATURE_FR[f.toLowerCase().trim()])
    }
  }
  const tl = (transcript ?? '').toLowerCase()
  for (const [k, v] of Object.entries(FEATURE_FR)) if (tl.includes(k)) feats.add(v)
  if (feats.size) c.features = [...feats]

  return c
}

/** Critères suffisants pour lancer une recherche (matching) ? */
export function isSearchable(c: LeadCriteria): boolean {
  return !!c.transaction_type && !!(c.type || (c.zones && c.zones.length) || c.budget_max)
}

/** Champs essentiels manquants pour un lead exploitable (pour le flag « à compléter »). */
export function computeMissing(c: LeadCriteria, contact: LeadContactInfo): string[] {
  const missing: string[] = []
  if (!contact.phone && !contact.email) missing.push('moyen de contact (téléphone ou email)')
  if (!c.transaction_type) missing.push('achat ou location')
  if (!c.type) missing.push('type de bien')
  if (!c.budget_max) missing.push('budget')
  if (!c.zones || !c.zones.length) missing.push('secteur')
  if (!c.rooms_min) missing.push('nombre de pièces')
  return missing
}

// ── Enrichissement continu (fusion NON DESTRUCTIVE) ──────────────────────────
// Quand un lead déjà qualifié reparle, on RAFFINE ses critères sans jamais écraser
// ce qui est posé (par l'agent ou une qualif antérieure) : on remplit les champs
// vides et on fait l'UNION des tableaux. On ne retire ni ne rétrécit JAMAIS rien.

/** Union sensible à la casse-insensible, ordre stable (existants d'abord, puis nouveaux). */
function unionCI(a?: string[], b?: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of [...(a ?? []), ...(b ?? [])]) {
    const t = (v ?? '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(t) }
  }
  return out
}

/** Fusionne les critères entrants dans les courants, sans rien écraser ni retirer. */
export function mergeCriteria(current: LeadCriteria | null | undefined, incoming: LeadCriteria | null | undefined): LeadCriteria {
  const cur = current ?? {}
  const inc = incoming ?? {}
  const out: LeadCriteria = { ...cur }
  // Scalaires : on remplit UNIQUEMENT si absent (jamais d'écrasement d'une valeur posée).
  if (out.transaction_type == null && inc.transaction_type != null) out.transaction_type = inc.transaction_type
  if (!out.type && inc.type) out.type = inc.type
  if (out.budget_min == null && inc.budget_min != null) out.budget_min = inc.budget_min
  if (out.budget_max == null && inc.budget_max != null) out.budget_max = inc.budget_max
  if (out.rooms_min == null && inc.rooms_min != null) out.rooms_min = inc.rooms_min
  if (out.rooms_max == null && inc.rooms_max != null) out.rooms_max = inc.rooms_max
  if (out.surface_min == null && inc.surface_min != null) out.surface_min = inc.surface_min
  // Tableaux : union (on n'enlève jamais une zone/prestation déjà connue).
  const zones = unionCI(cur.zones, inc.zones)
  const features = unionCI(cur.features, inc.features)
  if (zones.length) out.zones = zones; else delete out.zones
  if (features.length) out.features = features; else delete out.features
  return out
}

/** Décrit en FR ce que `after` ajoute par rapport à `before` (vide = aucun changement). */
export function criteriaDelta(before: LeadCriteria | null | undefined, after: LeadCriteria): string[] {
  const b = before ?? {}
  const d: string[] = []
  if (b.transaction_type == null && after.transaction_type != null) {
    d.push(after.transaction_type === 'rent' ? 'location' : 'achat')
  }
  if (!b.type && after.type) d.push(`type ${after.type}`)
  if (b.budget_max == null && after.budget_max != null) d.push(`budget ${after.budget_max}`)
  if (b.budget_min == null && after.budget_min != null) d.push(`budget min ${after.budget_min}`)
  if (b.rooms_min == null && after.rooms_min != null) d.push(`${after.rooms_min} pièces`)
  if (b.rooms_max == null && after.rooms_max != null) d.push(`max ${after.rooms_max} pièces`)
  if (b.surface_min == null && after.surface_min != null) d.push(`dès ${after.surface_min} m²`)
  const newZones = unionCI(after.zones).filter((z) => !unionCI(b.zones).some((x) => x.toLowerCase() === z.toLowerCase()))
  if (newZones.length) d.push(`secteur ${newZones.join('/')}`)
  const newFeats = unionCI(after.features).filter((f) => !unionCI(b.features).some((x) => x.toLowerCase() === f.toLowerCase()))
  if (newFeats.length) d.push(newFeats.join(', '))
  return d
}
