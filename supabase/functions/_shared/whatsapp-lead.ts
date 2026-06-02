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

const TYPE_FR_EN: Record<string, string> = {
  appartement: 'apartment', appart: 'apartment', studio: 'apartment', loft: 'apartment',
  maison: 'house', villa: 'villa', terrain: 'land', immeuble: 'building',
  commercial: 'commercial', bureau: 'office', local: 'commercial', parking: 'parking',
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
