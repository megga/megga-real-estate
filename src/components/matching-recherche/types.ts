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

/**
 * Champs de fiche chargés À LA DEMANDE, pour la seule annonce ouverte.
 *
 * Séparés de `MrhBien` volontairement : `description` pèse ~1,5 Ko en moyenne
 * (max 9,3 Ko) et la liste en charge jusqu'à 400 — la colonne est donc bannie de
 * `CARD_COLS` (CLAUDE.md §7). Ici on lit UNE ligne par sa PK, le coût est nul.
 */
export interface MrhBienDetail {
  description: string | null
  floor: number | null
  parking_count: number | null
  year_renovated: number | null
  usable_surface: number | null
  charges_monthly: number | null
  is_furnished: boolean | null
  availability_date: string | null
  visit_contact_name: string | null
  /** référence interne de la régie — repli quand `source_id` manque */
  agency_reference: string | null
}

/**
 * Filtre de plausibilité pour les champs des portails.
 *
 * La sync ingère ce que les portails déclarent, sans le corriger : on trouve des
 * étages à 99, des années de construction à 3 chiffres et des dates de
 * disponibilité en l'an 206. Ces valeurs sont rares (≤ 14 lignes par champ) mais
 * elles s'affichent telles quelles sur la fiche. On préfère MASQUER un champ
 * manifestement corrompu que d'imprimer une donnée fausse avec aplomb —
 * l'omission se lit comme « non renseigné », l'aberration comme un bug.
 */
export function plausible(v: number | null | undefined, min: number, max: number): number | null {
  return v == null || v < min || v > max ? null : v
}

/**
 * Idem pour une date ISO : hors [2000, 2100] = parse cassé côté portail.
 *
 * La date est aussi validée pour de vrai, pas seulement son année : le
 * consommateur la passe à `formatDate`, qui lève une RangeError sur une date
 * invalide et blanchirait la fiche. `availability_date` est aujourd'hui une
 * colonne `date` côté Postgres, donc toujours valide — mais ce helper est
 * générique et rien n'empêchera de l'appliquer demain à une colonne texte.
 */
export function plausibleDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  if (year < 2000 || year > 2100) return null
  // Aller-retour obligatoire : JS ne rejette pas les débordements, il les reporte
  // en silence — `new Date('2026-02-31')` vaut le 3 mars. Afficher « 03.03.2026 »
  // pour une donnée qui dit « 31.02 » serait pire que ne rien afficher.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) return null
  return iso
}

/**
 * Étage → clé i18n + paramètre, sans dépendre du traducteur.
 *
 * Extrait du composant pour être testable : 4 406 annonces actives sont au rez
 * et 2 455 en sous-sol, et une inversion des branches (`n < 0` avant `n === -1`)
 * donnerait « 1e sous-sol » au lieu de « Sous-sol » sans que rien ne le signale.
 */
export function floorLabelKey(n: number): { key: string; n?: number } {
  if (n === 0) return { key: 'floorGround' }
  if (n === -1) return { key: 'floorBasement' }
  if (n < 0) return { key: 'floorBasementN', n: Math.abs(n) }
  return { key: 'floorNth', n }
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
    // 12 annonces actives déclarent une année à 3 chiffres — cf `plausible`.
    year: plausible(num(row.year_built), 1200, 2100),
    land_surface: num(row.land_surface),
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

/** row (select ciblé sur une PK) → champs de fiche. Les valeurs aberrantes des
 *  portails sont filtrées ici, pas dans le composant (cf `plausible`). */
export function mapListingDetailRow(row: Record<string, unknown>): MrhBienDetail {
  const num = (v: unknown): number | null =>
    v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
  const desc = typeof row.description === 'string' ? row.description.trim() : ''
  return {
    description: desc || null,
    floor: plausible(num(row.floor), -6, 40),
    parking_count: plausible(num(row.parking_count), 1, 20),
    year_renovated: plausible(num(row.year_renovated), 1800, 2100),
    usable_surface: plausible(num(row.usable_surface), 1, 10000),
    charges_monthly: plausible(num(row.charges_monthly), 1, 20000),
    is_furnished: typeof row.is_furnished === 'boolean' ? row.is_furnished : null,
    availability_date: plausibleDate(row.availability_date as string | null),
    visit_contact_name: (row.visit_contact_name as string) ?? null,
    agency_reference: (row.agency_reference as string) ?? null,
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
