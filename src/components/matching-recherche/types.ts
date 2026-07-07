// Matching · Recherche hybride — formes de données (marché connecté + acheteurs).
//
// `MrhBien` = une row `market_listings` mappée pour l'UI Recherche (mêmes champs
// que le proto handoff `crm-matching-recherche.jsx`). `MrhContact` = un acheteur
// / locataire dérivé d'un `client_searches` actif (source réelle du modèle
// acheteur — PAS `contacts.search_criteria`, quasi vide en prod).

export type MrhTransaction = 'vente' | 'location'

/** Type de bien (enum interne market_listings) → libellé FR d'affichage. */
const TYPE_FR: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', villa: 'Villa', chalet: 'Chalet',
  attic: 'Attique', duplex: 'Duplex', studio: 'Studio', loft: 'Loft',
  office: 'Bureau', commercial: 'Commercial', retail: 'Commerce', building: 'Immeuble',
  parking: 'Parking', garage: 'Garage', storage: 'Dépôt', land: 'Terrain', other: 'Bien',
}

/** Équipements bruts éventuels → libellé FR (passe-plat si déjà lisible). */
const FEATURE_FR: Record<string, string> = {
  ascenseur: 'Ascenseur', lift: 'Ascenseur', elevator: 'Ascenseur',
  balcon: 'Balcon', balcony: 'Balcon', terrasse: 'Terrasse', terrace: 'Terrasse',
  jardin: 'Jardin', garden: 'Jardin', parking: 'Parking', garage: 'Garage',
  cave: 'Cave', cellar: 'Cave', parquet: 'Parquet', cheminee: 'Cheminée',
  fireplace: 'Cheminée', piscine: 'Piscine', pool: 'Piscine',
  climatisation: 'Climatisation', ac: 'Climatisation',
}

/** enum interne market_listings → libellé FR (pour les jetons de critère). */
export function typeLabelFr(t: string): string {
  return TYPE_FR[t] ?? (t ? t[0].toUpperCase() + t.slice(1) : t)
}

export interface MrhBien {
  id: string
  title: string
  addr: string
  /** enum interne ('apartment'…) — filtrage + `typeLabel` pour l'affichage */
  type: string
  typeLabel: string
  transaction: MrhTransaction
  /** prix de vente (null en location) */
  price: number | null
  /** loyer mensuel (null en vente) */
  rent: number | null
  /** prix affiché avant baisse (barré) */
  price_original: number | null
  price_per_m2: number | null
  rooms: number | null
  beds: number | null
  baths: number | null
  area: number | null
  year: number | null
  land_surface: number | null
  canton: string | null
  city: string | null
  postal_code: string | null
  lat: number | null
  lng: number | null
  features: string[]
  status: string
  /** toujours 'market' pour l'instant (annonces des portails) */
  source: 'market'
  source_portal: string | null
  source_url: string | null
  /** réf. portail (source_id) */
  ref: string | null
  agency: string | null
  agency_phone: string | null
  agency_logo_url: string | null
  days_on_market: number | null
  /** libellé relatif « il y a 3 j » (première détection) */
  postedAt: string
  /** rang de fraîcheur pour le tri « Récents » (plus petit = plus récent) */
  postedRank: number
  /** URLs photos (R2 `photos_cf` prioritaire, sinon `photos`) */
  photos: string[]
}

export interface MrhCriteria {
  transaction: MrhTransaction
  /** enums internes ('apartment'…) */
  types: string[]
  /** codes canton 2 lettres */
  cantons: string[]
  /** villes / quartiers (le reste des zones) */
  cities: string[]
  budgetMin: number | null
  budgetMax: number | null
  roomsMin: number | null
  roomsMax: number | null
  areaMin: number | null
  mustHave: string[]
}

export interface MrhContact {
  id: string           // contact_id
  searchId: string     // client_searches.id
  firstName: string
  lastName: string
  label: string        // libellé de la recherche
  criteria: MrhCriteria
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const isCantonCode = (z: string) => /^[A-Z]{2}$/.test(z)

/** row (RPC/select market_listings) → MrhBien. */
export function mapListingRow(row: Record<string, unknown>): MrhBien {
  const num = (v: unknown): number | null =>
    v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
  const tx: MrhTransaction = row.transaction_type === 'rent' ? 'location' : 'vente'
  const effPrice = num(row.current_price) ?? num(row.price)
  const priceWas = num(row.price_at_first_seen)
  const original = priceWas != null && effPrice != null && priceWas > effPrice ? priceWas : null
  const rawType = String(row.type ?? 'other')
  const photosCf = Array.isArray(row.photos_cf) ? (row.photos_cf as string[]) : []
  const photosRaw = Array.isArray(row.photos) ? (row.photos as string[]) : []
  const photos = (photosCf.length ? photosCf : photosRaw).filter((p): p is string => typeof p === 'string' && !!p)
  const rawFeatures = Array.isArray(row.features) ? (row.features as unknown[]) : []
  const features = rawFeatures
    .map((f) => (typeof f === 'string' ? f : ''))
    .filter(Boolean)
    .map((f) => FEATURE_FR[f.toLowerCase()] ?? cap(f))
  const addr = [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const dom = num(row.days_on_market)
  return {
    id: String(row.id),
    title: String(row.title ?? 'Annonce'),
    addr: addr || String(row.city ?? '—'),
    type: rawType,
    typeLabel: TYPE_FR[rawType] ?? cap(rawType),
    transaction: tx,
    price: tx === 'vente' ? effPrice : null,
    rent: tx === 'location' ? effPrice : null,
    price_original: original,
    price_per_m2: num(row.price_per_m2),
    rooms: num(row.rooms),
    beds: num(row.bedrooms),
    baths: num(row.bathrooms),
    area: num(row.surface_m2),
    year: num(row.year_built),
    land_surface: null,
    canton: (row.canton as string) ?? null,
    city: (row.city as string) ?? null,
    postal_code: (row.postal_code as string) ?? null,
    lat: num(row.lat),
    lng: num(row.lng),
    features,
    status: String(row.status ?? 'active'),
    source: 'market',
    source_portal: (row.source_portal as string) ?? null,
    source_url: (row.source_url as string) ?? null,
    ref: (row.source_id as string) ?? null,
    agency: (row.agency_name as string) ?? null,
    agency_phone: (row.agency_phone as string) ?? null,
    agency_logo_url: (row.agency_logo_url as string) ?? null,
    days_on_market: dom,
    postedAt: relativeDays(dom),
    postedRank: dom == null ? 9999 : dom,
    photos,
  }
}

/** client_searches (+ contact) → MrhContact. */
export function mapSearchRow(
  cs: { id: string; contact_id: string; label: string | null; criteria: Record<string, unknown> | null },
  contact: { first_name: string | null; last_name: string | null } | null,
): MrhContact {
  const c = cs.criteria ?? {}
  const zones = Array.isArray(c.zones) ? (c.zones as string[]).filter((z): z is string => typeof z === 'string') : []
  const rawType = typeof c.type === 'string' ? c.type : ''
  const num = (v: unknown): number | null => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    id: cs.contact_id,
    searchId: cs.id,
    firstName: contact?.first_name?.trim() || 'Contact',
    lastName: contact?.last_name?.trim() || '',
    label: cs.label?.trim() || 'Recherche',
    criteria: {
      transaction: c.transaction_type === 'rent' ? 'location' : 'vente',
      types: rawType ? [rawType] : [],
      cantons: zones.filter(isCantonCode),
      cities: zones.filter((z) => !isCantonCode(z)),
      budgetMin: num(c.budget_min),
      budgetMax: num(c.budget_max),
      roomsMin: num(c.rooms_min),
      roomsMax: num(c.rooms_max),
      areaMin: num(c.surface_min),
      mustHave: Array.isArray(c.features) ? (c.features as string[]).filter((f): f is string => typeof f === 'string') : [],
    },
  }
}

/** « il y a N j » à partir du nb de jours sur le marché. */
function relativeDays(days: number | null): string {
  if (days == null) return ''
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  if (days < 30) return `il y a ${Math.round(days / 7)} sem`
  return `il y a ${Math.round(days / 30)} mois`
}
