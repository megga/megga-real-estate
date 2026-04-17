// src/lib/listingTitle.ts
// Template-based listing title generator (no AI).
// Replaces per-listing translation for titles, which follow a predictable
// pattern across Flatfox data: "{Type} {rooms} pièces à {city}".

export type Lang = 'fr' | 'de' | 'en' | 'it'

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'commercial'
  | 'office'
  | 'parking'
  | 'storage'
  | 'land'

export type TransactionType = 'buy' | 'rent'

interface ListingLike {
  type?: string | null
  property_type?: string | null
  rooms?: number | null
  city?: string | null
  transaction_type?: string | null
  title?: string | null
}

// ── Property type labels ────────────────────────────────────────────────────

const TYPE_LABELS: Record<PropertyType, Record<Lang, string>> = {
  apartment:  { fr: 'Appartement',       de: 'Wohnung',       en: 'Apartment',        it: 'Appartamento' },
  house:      { fr: 'Maison',            de: 'Haus',          en: 'House',            it: 'Casa' },
  villa:      { fr: 'Villa',             de: 'Villa',         en: 'Villa',            it: 'Villa' },
  commercial: { fr: 'Local commercial',  de: 'Gewerbefläche', en: 'Commercial space', it: 'Locale commerciale' },
  office:     { fr: 'Bureau',            de: 'Büro',          en: 'Office',           it: 'Ufficio' },
  parking:    { fr: 'Place de parc',     de: 'Parkplatz',     en: 'Parking space',    it: 'Posto auto' },
  storage:    { fr: 'Dépôt',             de: 'Lager',         en: 'Storage',          it: 'Deposito' },
  land:       { fr: 'Terrain',           de: 'Grundstück',    en: 'Land',             it: 'Terreno' },
}

// ── Transaction labels ──────────────────────────────────────────────────────

const TX_LABELS: Record<TransactionType, Record<Lang, string>> = {
  rent: { fr: 'à louer',  de: 'zu vermieten', en: 'for rent', it: 'in affitto' },
  buy:  { fr: 'à vendre', de: 'zu verkaufen', en: 'for sale', it: 'in vendita' },
}

// ── Swiss city name mapping (major cities in 4 languages) ──────────────────
// Only maps cities whose name differs by language. Others pass through as-is.

const CITY_MAP: Record<string, Partial<Record<Lang, string>>> = {
  'Geneva':     { fr: 'Genève',    de: 'Genf',       it: 'Ginevra' },
  'Genève':     { de: 'Genf',      en: 'Geneva',     it: 'Ginevra' },
  'Genf':       { fr: 'Genève',    en: 'Geneva',     it: 'Ginevra' },
  'Zurich':     { de: 'Zürich',    it: 'Zurigo' },
  'Zürich':     { fr: 'Zurich',    en: 'Zurich',     it: 'Zurigo' },
  'Bern':       { fr: 'Berne',     it: 'Berna' },
  'Berne':      { de: 'Bern',      en: 'Bern',       it: 'Berna' },
  'Basel':      { fr: 'Bâle',      it: 'Basilea' },
  'Bâle':       { de: 'Basel',     en: 'Basel',      it: 'Basilea' },
  'Lucerne':    { de: 'Luzern',    en: 'Lucerne',    it: 'Lucerna' },
  'Luzern':     { fr: 'Lucerne',   en: 'Lucerne',    it: 'Lucerna' },
  'Biel':       { fr: 'Bienne',    it: 'Bienne' },
  'Bienne':     { de: 'Biel',      en: 'Biel' },
  'Neuchâtel':  { de: 'Neuenburg', it: 'Neuchâtel' },
  'Fribourg':   { de: 'Freiburg',  it: 'Friborgo' },
  'Freiburg':   { fr: 'Fribourg',  en: 'Fribourg',   it: 'Friborgo' },
  'Sion':       { de: 'Sitten',    it: 'Sion' },
  'Sitten':     { fr: 'Sion',      en: 'Sion' },
  'Lausanne':   { it: 'Losanna' },
  'Winterthour':{ de: 'Winterthur', en: 'Winterthur' },
  'Winterthur': { fr: 'Winterthour' },
  'Saint-Gall': { de: 'St. Gallen', en: 'St. Gallen', it: 'San Gallo' },
  'St. Gallen': { fr: 'Saint-Gall', en: 'St. Gallen', it: 'San Gallo' },
  'Lugano':     {},
  'Locarno':    {},
}

function translateCity(city: string, lang: Lang): string {
  const mapping = CITY_MAP[city]
  if (!mapping) return city
  return mapping[lang] || city
}

// ── Main generator ──────────────────────────────────────────────────────────

function normalizeType(raw?: string | null): PropertyType | null {
  if (!raw) return null
  const key = raw.toLowerCase().trim() as PropertyType
  return key in TYPE_LABELS ? key : null
}

function normalizeTx(raw?: string | null): TransactionType {
  return raw === 'rent' ? 'rent' : 'buy'
}

function formatRooms(rooms: number): string {
  // Swiss convention: "4.5 pièces" → "4.5". Keep as-is for numeric display.
  return Number.isInteger(rooms) ? String(rooms) : rooms.toFixed(1).replace(/\.0$/, '')
}

function roomsSuffix(lang: Lang, rooms: number): string {
  const n = formatRooms(rooms)
  switch (lang) {
    case 'fr': return `${n} pièces`
    case 'de': return `${n}-Zimmer`
    case 'en': return `${n} rooms`
    case 'it': return `${n} locali`
  }
}

export function generateListingTitle(
  listing: ListingLike,
  lang: Lang,
): string {
  const type = normalizeType(listing.type ?? listing.property_type)
  const rooms = Number(listing.rooms) || 0
  const city = (listing.city || '').trim()
  const tx = normalizeTx(listing.transaction_type)

  // Fallback: unknown type → use original title if available
  if (!type) {
    return (listing.title || '').trim() || cityFallback(city, lang, tx)
  }

  const typeLabel = TYPE_LABELS[type][lang]
  const txLabel = TX_LABELS[tx][lang]
  const cityLabel = city ? translateCity(city, lang) : ''

  // Parking/storage/land don't have rooms
  const hasRooms = rooms > 0 && (type === 'apartment' || type === 'house' || type === 'villa' || type === 'office')

  if (lang === 'de') {
    // "4.5-Zimmer-Wohnung in Genf zu vermieten"
    const parts = [
      hasRooms ? `${roomsSuffix('de', rooms)}-${typeLabel}` : typeLabel,
      cityLabel ? `in ${cityLabel}` : '',
      txLabel,
    ].filter(Boolean)
    return parts.join(' ')
  }

  if (lang === 'en') {
    // "4.5-room apartment in Geneva for rent"
    const parts = [
      hasRooms ? `${formatRooms(rooms)}-room ${typeLabel.toLowerCase()}` : typeLabel,
      cityLabel ? `in ${cityLabel}` : '',
      txLabel,
    ].filter(Boolean)
    return capitalize(parts.join(' '))
  }

  if (lang === 'it') {
    // "Appartamento 4.5 locali a Ginevra in affitto"
    const parts = [
      typeLabel,
      hasRooms ? roomsSuffix('it', rooms) : '',
      cityLabel ? `a ${cityLabel}` : '',
      txLabel,
    ].filter(Boolean)
    return parts.join(' ')
  }

  // fr (default)
  // "Appartement 4.5 pièces à Genève à louer"
  const parts = [
    typeLabel,
    hasRooms ? roomsSuffix('fr', rooms) : '',
    cityLabel ? `à ${cityLabel}` : '',
    txLabel,
  ].filter(Boolean)
  return parts.join(' ')
}

function cityFallback(city: string, lang: Lang, tx: TransactionType): string {
  const translated = city ? translateCity(city, lang) : ''
  const txLabel = TX_LABELS[tx][lang]
  if (!translated) return txLabel
  const prep = lang === 'de' ? 'in' : lang === 'en' ? 'in' : lang === 'it' ? 'a' : 'à'
  return `${prep} ${translated} ${txLabel}`
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
