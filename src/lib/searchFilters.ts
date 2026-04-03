import type { MarketFilters } from '@/hooks/useMarketListings'
import type { ListingCardData } from '@/components/listings/ListingCard'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type Context = 'buy' | 'rent'
export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'surface_desc' | 'best_deals' | 'recommended'

export interface Filters {
  context: Context
  q: string
  types: string[]
  minPrice: string
  maxPrice: string
  rooms: string
  minSurface: string
  bedrooms: string
  bathrooms: string
  city: string
  canton: string
  lifestyleTags: string[]
  energyLabel: string
  sort: SortOption
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'recommended', label: 'Recommandé pour vous' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'newest', label: 'Plus récent' },
  { value: 'surface_desc', label: 'Surface décroissante' },
  { value: 'best_deals', label: 'Meilleures affaires' },
]

export const BATHROOM_OPTIONS = ['1', '2', '3+']
export const ROOM_OPTIONS = ['1', '2', '3', '4', '5+']
export const BEDROOM_OPTIONS = ['1', '2', '3', '4+']

export const LIFESTYLE_TAGS: { value: string; label: string }[] = [
  { value: 'vue_lac', label: 'Vue lac' },
  { value: 'vue_montagne', label: 'Vue montagne' },
  { value: 'lumineux', label: 'Lumineux' },
  { value: 'quartier_calme', label: 'Quartier calme' },
  { value: 'proche_transports', label: 'Transports' },
  { value: 'proche_ecoles', label: 'Écoles' },
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'balcon', label: 'Balcon' },
  { value: 'jardin', label: 'Jardin' },
  { value: 'parking', label: 'Parking' },
  { value: 'piscine', label: 'Piscine' },
  { value: 'dernier_etage', label: 'Dernier étage' },
  { value: 'ascenseur', label: 'Ascenseur' },
  { value: 'meuble', label: 'Meublé' },
  { value: 'centre_ville', label: 'Centre-ville' },
]

export const ENERGY_OPTIONS = [
  { value: 'minergie', label: 'Minergie' },
  { value: 'A', label: 'Classe A' },
  { value: 'B', label: 'Classe B' },
  { value: 'C', label: 'Classe C' },
  { value: 'D+', label: 'Classe D et plus' },
]

export const CANTON_LABELS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug', SZ: 'Schwyz',
  NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris', SH: 'Schaffhouse',
  TG: 'Thurgovie', AR: 'Appenzell RE', AI: 'Appenzell RI', SG: 'Saint-Gall',
  GR: 'Grisons', TI: 'Tessin',
}

export const CANTON_SEARCH_ALIASES: Record<string, string> = {
  'geneve': 'GE', 'genève': 'GE', 'vaud': 'VD', 'valais': 'VS',
  'zurich': 'ZH', 'zürich': 'ZH', 'berne': 'BE', 'bern': 'BE',
  'tessin': 'TI', 'ticino': 'TI', 'fribourg': 'FR', 'neuchatel': 'NE',
  'neuchâtel': 'NE', 'jura': 'JU', 'bâle': 'BS', 'basel': 'BS',
  'lucerne': 'LU', 'luzern': 'LU', 'st-gall': 'SG', 'grisons': 'GR',
  'graubünden': 'GR', 'argovie': 'AG', 'aargau': 'AG', 'thurgovie': 'TG',
  'schaffhouse': 'SH', 'soleure': 'SO', 'zoug': 'ZG', 'zug': 'ZG',
  'schwyz': 'SZ', 'nidwald': 'NW', 'obwald': 'OW', 'uri': 'UR',
  'glaris': 'GL', 'appenzell': 'AR',
}

const CITY_ALIASES: Record<string, string> = {
  genève: 'Genève', geneve: 'Genève', gva: 'Genève',
  lausanne: 'Lausanne', nyon: 'Nyon', montreux: 'Montreux',
  vevey: 'Vevey', carouge: 'Carouge', lancy: 'Lancy',
  vernier: 'Vernier', meyrin: 'Meyrin', cologny: 'Cologny',
  veyrier: 'Veyrier', vandoeuvres: 'Vandoeuvres',
  champel: 'Genève', 'eaux_vives': 'Genève', 'eaux-vives': 'Genève',
  plainpalais: 'Genève', cornavin: 'Genève',
  pâquis: 'Genève', paquis: 'Genève', servette: 'Genève', jonction: 'Genève',
}

const TYPE_ALIASES: Record<string, string> = {
  appartement: 'apartment', appart: 'apartment', apt: 'apartment',
  maison: 'house', villa: 'villa',
  commercial: 'commercial', bureau: 'commercial', bureaux: 'commercial',
  terrain: 'land', parcelle: 'land',
}

// ─── SMART BADGE HELPER ────────────────────────────────────────────────────

export function getSmartBadge(listing: ListingCardData, medianPricePerM2?: number): { label: string; bg: string } | null {
  if (listing.price_drop_pct && listing.price_drop_pct >= 1) {
    return { label: `Baisse -${listing.price_drop_pct}%`, bg: 'bg-emerald-600/90' }
  }
  if (listing.days_on_market !== undefined && listing.days_on_market <= 3) {
    return { label: 'Nouveau', bg: 'bg-accent/90' }
  }
  if (medianPricePerM2 && listing.price_per_m2 && listing.price_per_m2 < medianPricePerM2 * 0.88 && listing.days_on_market !== undefined && listing.days_on_market <= 14) {
    return { label: 'Forte demande', bg: 'bg-orange-500/90' }
  }
  if (listing.is_hot) {
    return { label: 'Prix reduit', bg: 'bg-emerald-600/90' }
  }
  if (listing.is_exclusive) {
    return { label: 'MEGGA', bg: 'bg-gray-900' }
  }
  if (listing.days_on_market !== undefined && listing.days_on_market >= 45) {
    return { label: `${listing.days_on_market}j en ligne`, bg: 'bg-gray-500/80' }
  }
  return null
}

// ─── AI QUERY PARSER ────────────────────────────────────────────────────────

interface ParsedQuery {
  filters: Partial<Filters>
  understood: string[]
}

export function parseNaturalLanguageQuery(query: string): ParsedQuery {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const original = query.toLowerCase()
  const filters: Partial<Filters> = {}
  const understood: string[] = []

  if (/\b(louer|location|loue|a\s+louer|mensuel|mois)\b/.test(original)) {
    filters.context = 'rent'
    understood.push('Location')
  } else if (/\b(acheter|achat|achete|vente|a\s+vendre)\b/.test(original)) {
    filters.context = 'buy'
    understood.push('Achat')
  }

  const roomsMatch = q.match(/(\d+(?:[.,]\d)?)\s*(?:pieces?|pi[eè]ces?|p\.?\b|½)/i)
  if (roomsMatch) {
    const rooms = Math.floor(parseFloat(roomsMatch[1].replace(',', '.')))
    if (rooms >= 1 && rooms <= 10) {
      filters.rooms = rooms >= 5 ? '5+' : String(rooms)
      understood.push(`${rooms} pièces`)
    }
  }

  const bedroomsMatch = q.match(/(\d+)\s*(?:chambres?|ch\.?\b)/i)
  if (bedroomsMatch) {
    const bed = parseInt(bedroomsMatch[1])
    if (bed >= 1 && bed <= 10) {
      filters.bedrooms = bed >= 4 ? '4+' : String(bed)
      understood.push(`${bed} chambre${bed > 1 ? 's' : ''}`)
    }
  }

  const priceMax = q.match(/(?:max(?:imum)?|moins\s+de|budget|jusqu'?\s*[aà])\s*(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(k|m|'?\d*)/)
  if (priceMax) {
    let price = parseFloat(priceMax[1].replace(',', '.'))
    const unit = priceMax[2]?.toLowerCase()
    if (unit === 'k') price *= 1000
    else if (unit === 'm') price *= 1000000
    filters.maxPrice = String(Math.round(price))
    understood.push(`Max CHF ${price >= 1000000 ? `${price / 1000000}M` : price >= 1000 ? `${price / 1000}K` : price}`)
  }

  const priceMin = q.match(/(?:a\s+partir\s+de|des|minimum|min)\s*(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(k|m|'?\d*)/)
  if (priceMin) {
    let price = parseFloat(priceMin[1].replace(',', '.'))
    const unit = priceMin[2]?.toLowerCase()
    if (unit === 'k') price *= 1000
    else if (unit === 'm') price *= 1000000
    filters.minPrice = String(Math.round(price))
    understood.push(`Min CHF ${price >= 1000000 ? `${price / 1000000}M` : price >= 1000 ? `${price / 1000}K` : price}`)
  }

  if (!priceMax && !priceMin) {
    const standalonePrice = q.match(/(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(k|m)\b/)
    if (standalonePrice) {
      let price = parseFloat(standalonePrice[1].replace(',', '.'))
      const unit = standalonePrice[2].toLowerCase()
      if (unit === 'k') price *= 1000
      else if (unit === 'm') price *= 1000000
      filters.maxPrice = String(Math.round(price))
      understood.push(`Max CHF ${price >= 1000000 ? `${price / 1000000}M` : `${price / 1000}K`}`)
    }
  }

  const surfaceMatch = q.match(/(?:min(?:imum)?\s*)?(\d+)\s*m[²2]/)
  if (surfaceMatch) {
    filters.minSurface = surfaceMatch[1]
    understood.push(`Min ${surfaceMatch[1]} m²`)
  }

  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (original.includes(alias)) {
      filters.city = city
      understood.push(city)
      break
    }
  }

  if (!filters.city) {
    for (const [alias, code] of Object.entries(CANTON_SEARCH_ALIASES)) {
      if (q.includes(alias)) {
        filters.canton = code
        understood.push(CANTON_LABELS[code] || code)
        break
      }
    }
    if (!filters.canton) {
      const cantonMatch = original.match(/\b([A-Z]{2})\b/)
      if (cantonMatch && CANTON_LABELS[cantonMatch[1]]) {
        filters.canton = cantonMatch[1]
        understood.push(CANTON_LABELS[cantonMatch[1]])
      }
    }
  }

  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    if (original.includes(alias)) {
      filters.types = [type]
      understood.push(alias.charAt(0).toUpperCase() + alias.slice(1))
      break
    }
  }

  const lifestyleKeywords: Record<string, { tag: string; label: string }> = {
    'vue lac': { tag: 'vue_lac', label: 'Vue lac' },
    'vue sur le lac': { tag: 'vue_lac', label: 'Vue lac' },
    'bord du lac': { tag: 'vue_lac', label: 'Vue lac' },
    'vue montagne': { tag: 'vue_montagne', label: 'Vue montagne' },
    'vue alpes': { tag: 'vue_montagne', label: 'Vue montagne' },
    'lumineux': { tag: 'lumineux', label: 'Lumineux' },
    'lumiere': { tag: 'lumineux', label: 'Lumineux' },
    'ensoleille': { tag: 'lumineux', label: 'Lumineux' },
    'calme': { tag: 'quartier_calme', label: 'Quartier calme' },
    'tranquille': { tag: 'quartier_calme', label: 'Quartier calme' },
    'residentiel': { tag: 'quartier_calme', label: 'Quartier calme' },
    'transport': { tag: 'proche_transports', label: 'Transports' },
    'tram': { tag: 'proche_transports', label: 'Transports' },
    'bus': { tag: 'proche_transports', label: 'Transports' },
    'gare': { tag: 'proche_transports', label: 'Transports' },
    'metro': { tag: 'proche_transports', label: 'Transports' },
    'ecole': { tag: 'proche_ecoles', label: 'Écoles' },
    'ecoles': { tag: 'proche_ecoles', label: 'Écoles' },
    'enfant': { tag: 'proche_ecoles', label: 'Écoles' },
    'familial': { tag: 'proche_ecoles', label: 'Écoles' },
    'famille': { tag: 'proche_ecoles', label: 'Écoles' },
    'terrasse': { tag: 'terrasse', label: 'Terrasse' },
    'balcon': { tag: 'balcon', label: 'Balcon' },
    'jardin': { tag: 'jardin', label: 'Jardin' },
    'parking': { tag: 'parking', label: 'Parking' },
    'garage': { tag: 'parking', label: 'Parking' },
    'piscine': { tag: 'piscine', label: 'Piscine' },
    'dernier etage': { tag: 'dernier_etage', label: 'Dernier étage' },
    'attique': { tag: 'dernier_etage', label: 'Dernier étage' },
    'ascenseur': { tag: 'ascenseur', label: 'Ascenseur' },
    'meuble': { tag: 'meuble', label: 'Meublé' },
    'centre': { tag: 'centre_ville', label: 'Centre-ville' },
    'centre-ville': { tag: 'centre_ville', label: 'Centre-ville' },
  }

  const detectedTags: string[] = []
  for (const [keyword, { tag, label }] of Object.entries(lifestyleKeywords)) {
    if (q.includes(keyword) && !detectedTags.includes(tag)) {
      detectedTags.push(tag)
      understood.push(label)
    }
  }
  if (detectedTags.length) {
    filters.lifestyleTags = detectedTags
  }

  return { filters, understood }
}

// ─── FILTER HELPERS ────────────────────────────────────────────────────────

export function parseFiltersFromParams(params: URLSearchParams): Filters {
  return {
    context: (params.get('context') as Context) || 'buy',
    q: params.get('q') || '',
    types: params.get('type')?.split(',').filter(Boolean) || [],
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    rooms: params.get('rooms') || '',
    minSurface: params.get('minSurface') || '',
    bedrooms: params.get('bedrooms') || '',
    bathrooms: params.get('bathrooms') || '',
    city: params.get('city') || '',
    canton: params.get('canton') || '',
    lifestyleTags: params.get('lifestyle')?.split(',').filter(Boolean) || [],
    energyLabel: params.get('energyLabel') || '',
    sort: (params.get('sort') as SortOption) || 'relevance',
  }
}

export function filtersToParams(filters: Filters): Record<string, string> {
  const p: Record<string, string> = {}
  if (filters.context !== 'buy') p.context = filters.context
  if (filters.q) p.q = filters.q
  if (filters.types.length) p.type = filters.types.join(',')
  if (filters.minPrice) p.minPrice = filters.minPrice
  if (filters.maxPrice) p.maxPrice = filters.maxPrice
  if (filters.rooms) p.rooms = filters.rooms
  if (filters.minSurface) p.minSurface = filters.minSurface
  if (filters.bedrooms) p.bedrooms = filters.bedrooms
  if (filters.bathrooms) p.bathrooms = filters.bathrooms
  if (filters.city) p.city = filters.city
  if (filters.canton) p.canton = filters.canton
  if (filters.lifestyleTags.length) p.lifestyle = filters.lifestyleTags.join(',')
  if (filters.energyLabel) p.energyLabel = filters.energyLabel
  if (filters.sort !== 'relevance') p.sort = filters.sort
  return p
}

export function toServerFilters(filters: Filters): MarketFilters {
  const sf: MarketFilters = {
    context: filters.context,
    sort: filters.sort,
  }

  if (filters.types.length > 0) sf.types = filters.types
  if (filters.minPrice) sf.minPrice = Number(filters.minPrice)
  if (filters.maxPrice) sf.maxPrice = Number(filters.maxPrice)
  if (filters.city) sf.city = filters.city
  if (filters.canton) sf.canton = filters.canton
  if (filters.minSurface) sf.minSurface = Number(filters.minSurface)
  if (filters.q) sf.q = filters.q

  if (filters.rooms) {
    const minRooms = filters.rooms.endsWith('+')
      ? Number(filters.rooms.replace('+', ''))
      : Number(filters.rooms)
    sf.minRooms = minRooms
  }

  if (filters.bedrooms) {
    const minBed = filters.bedrooms.endsWith('+')
      ? Number(filters.bedrooms.replace('+', ''))
      : Number(filters.bedrooms)
    sf.minBedrooms = minBed
  }

  if (filters.bathrooms) {
    const minBath = filters.bathrooms.endsWith('+')
      ? Number(filters.bathrooms.replace('+', ''))
      : Number(filters.bathrooms)
    sf.minBathrooms = minBath
  }

  if (filters.energyLabel) sf.energyLabel = filters.energyLabel

  return sf
}
