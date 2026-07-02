// supabase/functions/_shared/idx-mapper.ts
//
// Sérialiseur IDX 3.01 — premier chemin de SYNDICATION SORTANTE de MEGGA.
// IDX (« idix ») est le standard suisse d'import d'annonces (immobilier.ch,
// Homegate, ImmoScout24…). Format : 1 ligne CSV par bien, séparateur « ; »,
// UTF-8, 183 colonnes (indices 0..182). Le portail va CHERCHER le feed (pull)
// et l'importe ; « publier » = inscrire le bien dans le feed de l'agence.
//
// HELPER PUR : aucun import Deno / `https:` ici, pour qu'il tourne aussi sous
// Node+Vitest (cf. vitest.config.ts `include`). La logique d'I/O (DB, HTTP)
// vit dans l'edge function `idx-feed`, pas ici.
//
// Indices de colonnes + codes catégorie/type/offre VERROUILLÉS contre
// l'implémentation de référence open-source OpenEstate-IO-IDX (FIELD_*,
// ObjectCategory, ObjectType, OfferType). On ne fabrique aucun code.
//
// ⚠ TODO(immobilier.ch) — à confirmer au branchement réel du transport :
//   - le token exact du champ version (IDX_VERSION ci-dessous)
//   - la liste de codes object_type acceptés côté immobilier.ch
//   - les valeurs price_unit (loyer mensuel vs total) si exigées
//   - format de date attendu (on émet DD.MM.YYYY)
//   - images servies par URL (mode pull) vs binaires livrés en FTP

export const IDX_VERSION = 'IDX3.01' // TODO(immobilier.ch): confirmer le token exact
export const IDX_COLUMN_COUNT = 183
export const IDX_SEPARATOR = ';'
export const IDX_LINE_TERMINATOR = '\r\n'
export const IDX_DEFAULT_SENDER_ID = 'MEGGA'

// ─── Indices de colonnes (sous-ensemble peuplé) ──────────────────────────────
// Noms calqués sur les constantes FIELD_* d'OpenEstate-IO-IDX.
export const F = {
  VERSION: 0,
  SENDER_ID: 1,
  OBJECT_CATEGORY: 2,
  OBJECT_TYPE: 3,
  OFFER_TYPE: 4,
  REF_PROPERTY: 5,
  REF_HOUSE: 6,
  REF_OBJECT: 7,
  OBJECT_STREET: 8,
  OBJECT_ZIP: 9,
  OBJECT_CITY: 10,
  OBJECT_STATE: 11,
  OBJECT_COUNTRY: 12,
  REGION: 13,
  OBJECT_SITUATION: 14,
  AVAILABLE_FROM: 15,
  OBJECT_TITLE: 16,
  OBJECT_DESCRIPTION: 17,
  SELLING_PRICE: 18,
  RENT_NET: 19,
  RENT_EXTRA: 20,
  PRICE_UNIT: 21,
  CURRENCY: 22,
  GROSS_PREMIUM: 23,
  FLOOR: 24,
  NUMBER_OF_ROOMS: 25,
  NUMBER_OF_APARTMENTS: 26,
  SURFACE_LIVING: 27,
  SURFACE_PROPERTY: 28,
  SURFACE_USABLE: 29,
  VOLUME: 30,
  YEAR_BUILT: 31,
  AGENCY_ID: 68,
  AGENCY_NAME: 69,
  AGENCY_NAME2: 70,
  AGENCY_REFERENCE: 71,
  AGENCY_STREET: 72,
  AGENCY_ZIP: 73,
  AGENCY_CITY: 74,
  AGENCY_COUNTRY: 75,
  AGENCY_PHONE: 76,
  AGENCY_MOBILE: 77,
  AGENCY_FAX: 78,
  AGENCY_EMAIL: 79,
  AGENCY_LOGO: 80,
  PUBLISH_UNTIL: 85,
  OWN_OBJECT_URL: 126,
  LAST_MODIFIED: 177,
  ADVERTISEMENT_ID: 178,
} as const

// 13 emplacements photo, dans l'ordre des colonnes IDX (URL only — mode pull).
export const PICTURE_URL_INDICES = [99, 100, 101, 102, 103, 104, 105, 106, 107, 154, 155, 156, 157]
export const MAX_PICTURES = PICTURE_URL_INDICES.length

// ─── Mapping property_type MEGGA → (object_category, object_type IDX) ─────────
// Codes sourcés OpenEstate ObjectType : APPT_GENERAL=1, HOUSE_SINGLE_FAMILY=1,
// HOUSE_VILLA=5, INDUS_COMMERCIAL=4, PROP_BUILDING=1.
// property_type enum DB = apartment | house | villa | commercial | land.
export const TYPE_MAP: Record<string, { category: string; code: number }> = {
  apartment: { category: 'APPT', code: 1 },
  house: { category: 'HOUSE', code: 1 },
  villa: { category: 'HOUSE', code: 5 },
  commercial: { category: 'INDUS', code: 4 },
  land: { category: 'PROP', code: 1 },
}
export const TYPE_FALLBACK = { category: 'APPT', code: 1 }

// ─── Contrats d'entrée (découplés des noms de colonnes DB) ────────────────────
export interface IdxProperty {
  id: string
  ref?: string | null
  type?: string | null            // property_type
  transactionType?: string | null // 'buy' | 'rent'
  title?: string | null
  description?: string | null
  price?: number | null
  chargesMonthly?: number | null
  currency?: string | null
  rooms?: number | null
  surfaceM2?: number | null
  floor?: number | null
  yearBuilt?: number | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  canton?: string | null
  availabilityDate?: string | null // ISO
  photos?: string[] | null
  publishUntil?: string | null      // ISO (ex. mandate_expires_at)
  updatedAt?: string | null         // ISO
  externalRef?: string | null       // advertisement_id renvoyé par le portail (updates)
  listingUrl?: string | null
}

export interface IdxAgency {
  id: string
  name: string
  street?: string | null
  city?: string | null
  canton?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
}

export interface IdxBuildOptions {
  senderId?: string
}

// ─── Helpers de formatage ────────────────────────────────────────────────────

/** Neutralise le séparateur et les sauts de ligne dans un champ texte libre.
 *  IDX 3.01 n'a pas de quoting fiable côté consommateurs → on assainit. */
export function sanitizeIdxText(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/;/g, ',')
    .replace(/"/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Entier sans décimale ni séparateur de milliers (prix). '' si invalide/≤0 non requis. */
export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(Math.round(value))
}

/** Nombre avec décimales utiles, point décimal, sans zéros de fin (surfaces, pièces). */
export function formatNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  const s = String(value)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** ISO (YYYY-MM-DD ou datetime) → DD.MM.YYYY. Passe-plat si non parsable. */
export function formatIdxDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return sanitizeIdxText(iso)
  return `${m[3]}.${m[2]}.${m[1]}`
}

// ─── Construction d'une ligne IDX (183 colonnes) ─────────────────────────────
export function propertyToIdxRow(
  p: IdxProperty,
  agency: IdxAgency,
  opts: IdxBuildOptions = {},
): string[] {
  const row = new Array<string>(IDX_COLUMN_COUNT).fill('')

  row[F.VERSION] = IDX_VERSION
  row[F.SENDER_ID] = sanitizeIdxText(opts.senderId ?? IDX_DEFAULT_SENDER_ID)

  const typeMap = TYPE_MAP[(p.type ?? '').toLowerCase()] ?? TYPE_FALLBACK
  row[F.OBJECT_CATEGORY] = typeMap.category
  row[F.OBJECT_TYPE] = String(typeMap.code)
  const isRent = (p.transactionType ?? 'buy').toLowerCase() === 'rent'
  row[F.OFFER_TYPE] = isRent ? 'RENT' : 'SALE'

  const ref = p.ref ?? p.id
  row[F.REF_OBJECT] = sanitizeIdxText(ref)
  row[F.REF_PROPERTY] = sanitizeIdxText(p.id)

  // Localisation
  row[F.OBJECT_STREET] = sanitizeIdxText(p.address)
  row[F.OBJECT_ZIP] = sanitizeIdxText(p.postalCode)
  row[F.OBJECT_CITY] = sanitizeIdxText(p.city)
  row[F.OBJECT_STATE] = sanitizeIdxText(p.canton)
  row[F.OBJECT_COUNTRY] = 'CH'

  row[F.AVAILABLE_FROM] = formatIdxDate(p.availabilityDate)
  row[F.OBJECT_TITLE] = sanitizeIdxText(p.title)
  row[F.OBJECT_DESCRIPTION] = sanitizeIdxText(p.description)

  // Prix : vente → selling_price ; location → rent_net (+ rent_extra = charges)
  if (isRent) {
    row[F.RENT_NET] = formatInt(p.price)
    row[F.RENT_EXTRA] = formatInt(p.chargesMonthly)
  } else {
    row[F.SELLING_PRICE] = formatInt(p.price)
  }
  row[F.CURRENCY] = sanitizeIdxText(p.currency ?? 'CHF')

  // Surfaces / pièces
  row[F.NUMBER_OF_ROOMS] = formatNum(p.rooms)
  row[F.SURFACE_LIVING] = formatNum(p.surfaceM2)
  row[F.FLOOR] = formatInt(p.floor)
  row[F.YEAR_BUILT] = formatInt(p.yearBuilt)

  // Photos → emplacements URL (cap 13)
  const photos = (p.photos ?? []).filter((u) => typeof u === 'string' && u.trim() !== '')
  for (let i = 0; i < Math.min(photos.length, MAX_PICTURES); i++) {
    row[PICTURE_URL_INDICES[i]] = sanitizeIdxText(photos[i])
  }

  // Bloc agence
  row[F.AGENCY_ID] = sanitizeIdxText(agency.id)
  row[F.AGENCY_NAME] = sanitizeIdxText(agency.name)
  row[F.AGENCY_STREET] = sanitizeIdxText(agency.street)
  row[F.AGENCY_CITY] = sanitizeIdxText(agency.city)
  row[F.AGENCY_COUNTRY] = 'CH'
  row[F.AGENCY_PHONE] = sanitizeIdxText(agency.phone)
  row[F.AGENCY_EMAIL] = sanitizeIdxText(agency.email)
  row[F.AGENCY_LOGO] = sanitizeIdxText(agency.logoUrl)

  // Méta
  row[F.PUBLISH_UNTIL] = formatIdxDate(p.publishUntil)
  row[F.OWN_OBJECT_URL] = sanitizeIdxText(p.listingUrl)
  row[F.LAST_MODIFIED] = formatIdxDate(p.updatedAt)
  row[F.ADVERTISEMENT_ID] = sanitizeIdxText(p.externalRef)

  return row
}

/** Sérialise des lignes (déjà construites) en feed IDX complet. */
export function serializeIdxFeed(rows: string[][]): string {
  if (rows.length === 0) return ''
  return (
    rows
      .map((r) => {
        // Garde-fou : toujours exactement IDX_COLUMN_COUNT colonnes.
        const safe = r.length === IDX_COLUMN_COUNT ? r : padRow(r)
        return safe.join(IDX_SEPARATOR)
      })
      .join(IDX_LINE_TERMINATOR) + IDX_LINE_TERMINATOR
  )
}

function padRow(r: string[]): string[] {
  const out = new Array<string>(IDX_COLUMN_COUNT).fill('')
  for (let i = 0; i < Math.min(r.length, IDX_COLUMN_COUNT); i++) out[i] = r[i] ?? ''
  return out
}

/** Construit le feed IDX complet à partir des biens + agence. */
export function buildIdxFeed(
  properties: IdxProperty[],
  agency: IdxAgency,
  opts: IdxBuildOptions = {},
): string {
  return serializeIdxFeed(properties.map((p) => propertyToIdxRow(p, agency, opts)))
}

// ─── Validation préflight (réutilisée par l'UI et les outils WhatsApp) ────────
/** Renvoie la liste des manques bloquant la syndication (vide = prêt). */
export function validateIdxProperty(p: IdxProperty): string[] {
  const missing: string[] = []
  if (!p.type) missing.push('type')
  if (!p.transactionType) missing.push('transaction_type')
  if (!p.title || sanitizeIdxText(p.title) === '') missing.push('title')
  if (p.price == null || !(p.price > 0)) missing.push('price')
  if (!p.address || sanitizeIdxText(p.address) === '') missing.push('address')
  if (!p.postalCode || sanitizeIdxText(p.postalCode) === '') missing.push('postal_code')
  if (!p.city || sanitizeIdxText(p.city) === '') missing.push('city')
  const photos = (p.photos ?? []).filter((u) => typeof u === 'string' && u.trim() !== '')
  if (photos.length === 0) missing.push('photos')
  return missing
}

// ─── Mappers ligne DB → contrat IDX (PURS, partagés pull + push FTP) ──────────
// PostgREST renvoie les `numeric` en CHAÎNE → on coerce. Champ absent = null
// (jamais inventé). Réutilisés par idx-feed (pull) et idx-syndicate (push).

/** Coerce number | string | null → number | null (NaN/'' → null). */
export function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export interface IdxPropertyRow {
  id: string
  type?: string | null
  transaction_type?: string | null
  title?: string | null
  description?: string | null
  price?: number | string | null
  charges_monthly?: number | string | null
  currency?: string | null
  rooms?: number | string | null
  surface_m2?: number | string | null
  floor?: number | null
  year_built?: number | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  canton?: string | null
  availability_date?: string | null
  photos?: string[] | null
  mandate_expires_at?: string | null
  updated_at?: string | null
}

export interface IdxAgencyRow {
  id: string
  name: string
  address?: string | null
  city?: string | null
  canton?: string | null
  phone?: string | null
  email?: string | null
  logo_url?: string | null
}

export function propertyRowToIdxInput(
  row: IdxPropertyRow,
  opts: { externalRef?: string | null; listingBaseUrl?: string | null } = {},
): IdxProperty {
  return {
    id: row.id,
    ref: row.id,
    type: row.type ?? null,
    transactionType: row.transaction_type ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    price: toNum(row.price),
    chargesMonthly: toNum(row.charges_monthly),
    currency: row.currency ?? null,
    rooms: toNum(row.rooms),
    surfaceM2: toNum(row.surface_m2),
    floor: row.floor ?? null,
    yearBuilt: row.year_built ?? null,
    address: row.address ?? null,
    postalCode: row.postal_code ?? null,
    city: row.city ?? null,
    canton: row.canton ?? null,
    availabilityDate: row.availability_date ?? null,
    photos: row.photos ?? [],
    publishUntil: row.mandate_expires_at ?? null,
    updatedAt: row.updated_at ?? null,
    externalRef: opts.externalRef ?? null,
    listingUrl: opts.listingBaseUrl ? `${opts.listingBaseUrl}/${row.id}` : null,
  }
}

export function agencyRowToIdxAgency(row: IdxAgencyRow): IdxAgency {
  return {
    id: row.id,
    name: row.name,
    street: row.address ?? null,
    city: row.city ?? null,
    canton: row.canton ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    logoUrl: row.logo_url ?? null,
  }
}
