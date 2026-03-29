import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  X,
  MapPin,
  Heart,
  LayoutGrid,
  List,
  DoorOpen,
  BedDouble,
  Maximize,
  Map,
  SlidersHorizontal,
  Sparkles,
  Building2,
  Train,
  GitCompareArrows,
  Check,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import MapView, { type MapViewHandle } from '@/components/map/MapView'
import ChatSearch from '@/components/search/ChatSearch'
import CompareDrawer from '@/components/listings/CompareDrawer'
import ListingPreviewPanel from '@/components/listing/ListingPreviewPanel'
import SaveSearchDialog from '@/components/search/SaveSearchDialog'
import SavedSearchesList from '@/components/search/SavedSearchesList'
import { useMarketListings, useMapPoints, useMarketStats, type MarketFilters } from '@/hooks/useMarketListings'
import { sortByRecommendation } from '@/lib/recommendationScore'
import { useFavorites } from '@/hooks/useFavorites'
import { cn, formatCHF, formatSurface, formatRelativeDate } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS } from '@/lib/constants'
import type { ListingCardData } from '@/components/listings/ListingCard'
import { findNearestStation, formatStationDistance } from '@/lib/stations'
import { useMarketTemperature } from '@/hooks/useMarketInsights'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type Context = 'buy' | 'rent'
type ViewMode = 'list' | 'grid'
type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'surface_desc' | 'best_deals' | 'recommended'

interface Filters {
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
  view: ViewMode
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'recommended', label: 'Recommandé pour vous' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'newest', label: 'Plus récent' },
  { value: 'surface_desc', label: 'Surface décroissante' },
  { value: 'best_deals', label: 'Meilleures affaires' },
]

const BATHROOM_OPTIONS = ['1', '2', '3+']

const ROOM_OPTIONS = ['1', '2', '3', '4', '5+']
const BEDROOM_OPTIONS = ['1', '2', '3', '4+']

const LIFESTYLE_TAGS: { value: string; label: string }[] = [
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

const ENERGY_OPTIONS = [
  { value: 'minergie', label: 'Minergie' },
  { value: 'A', label: 'Classe A' },
  { value: 'B', label: 'Classe B' },
  { value: 'C', label: 'Classe C' },
  { value: 'D+', label: 'Classe D et plus' },
]

const CANTON_LABELS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug', SZ: 'Schwyz',
  NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris', SH: 'Schaffhouse',
  TG: 'Thurgovie', AR: 'Appenzell RE', AI: 'Appenzell RI', SG: 'Saint-Gall',
  GR: 'Grisons', TI: 'Tessin',
}

const CANTON_SEARCH_ALIASES: Record<string, string> = {
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

const PRICE_RANGES_BUY = [
  { min: '', max: '500000', label: "Jusqu'à CHF 500'000" },
  { min: '500000', max: '800000', label: "CHF 500'000 – 800'000" },
  { min: '800000', max: '1200000', label: "CHF 800'000 – 1'200'000" },
  { min: '1200000', max: '2000000', label: "CHF 1'200'000 – 2'000'000" },
  { min: '2000000', max: '', label: "Dès CHF 2'000'000" },
]

const PRICE_RANGES_RENT = [
  { min: '', max: '1500', label: "Jusqu'à CHF 1'500/mois" },
  { min: '1500', max: '2500', label: "CHF 1'500 – 2'500/mois" },
  { min: '2500', max: '4000', label: "CHF 2'500 – 4'000/mois" },
  { min: '4000', max: '', label: "Dès CHF 4'000/mois" },
]

// ─── SMART BADGE HELPER ──────────────────────────────────────────────────────

function getSmartBadge(listing: ListingCardData, medianPricePerM2?: number): { label: string; bg: string } | null {
  // Priority: price drop > new > hot demand > hot price > exclusive > stale
  if (listing.price_drop_pct && listing.price_drop_pct >= 1) {
    return { label: `Baisse -${listing.price_drop_pct}%`, bg: 'bg-emerald-600/90' }
  }
  if (listing.days_on_market !== undefined && listing.days_on_market <= 3) {
    return { label: 'Nouveau', bg: 'bg-accent/90' }
  }
  // Hot score: attractive price + fresh
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

function formatPricePerM2(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K/m²`
  return `${Math.round(value)}/m²`
}

// ─── AI QUERY PARSER ────────────────────────────────────────────────────────

interface ParsedQuery {
  filters: Partial<Filters>
  understood: string[]
}

const CITY_ALIASES: Record<string, string> = {
  genève: 'Genève', geneve: 'Genève', gva: 'Genève',
  lausanne: 'Lausanne',
  nyon: 'Nyon',
  montreux: 'Montreux',
  vevey: 'Vevey',
  carouge: 'Carouge',
  lancy: 'Lancy',
  vernier: 'Vernier',
  meyrin: 'Meyrin',
  cologny: 'Cologny',
  veyrier: 'Veyrier',
  vandoeuvres: 'Vandoeuvres',
  champel: 'Genève',
  'eaux_vives': 'Genève', 'eaux-vives': 'Genève',
  plainpalais: 'Genève',
  cornavin: 'Genève',
  pâquis: 'Genève', paquis: 'Genève',
  servette: 'Genève',
  jonction: 'Genève',
}

const TYPE_ALIASES: Record<string, string> = {
  appartement: 'apartment', appart: 'apartment', apt: 'apartment',
  maison: 'house',
  villa: 'villa',
  commercial: 'commercial', bureau: 'commercial', bureaux: 'commercial',
  terrain: 'land', parcelle: 'land',
}

function parseNaturalLanguageQuery(query: string): ParsedQuery {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const original = query.toLowerCase()
  const filters: Partial<Filters> = {}
  const understood: string[] = []

  // Context: buy or rent
  if (/\b(louer|location|loue|a\s+louer|mensuel|mois)\b/.test(original)) {
    filters.context = 'rent'
    understood.push('Location')
  } else if (/\b(acheter|achat|achete|vente|a\s+vendre)\b/.test(original)) {
    filters.context = 'buy'
    understood.push('Achat')
  }

  // Rooms: "3 pièces", "4p", "3.5 pièces"
  const roomsMatch = q.match(/(\d+(?:[.,]\d)?)\s*(?:pieces?|pi[eè]ces?|p\.?\b|½)/i)
  if (roomsMatch) {
    const rooms = Math.floor(parseFloat(roomsMatch[1].replace(',', '.')))
    if (rooms >= 1 && rooms <= 10) {
      filters.rooms = rooms >= 5 ? '5+' : String(rooms)
      understood.push(`${rooms} pièces`)
    }
  }

  // Bedrooms: "3 chambres", "2 ch"
  const bedroomsMatch = q.match(/(\d+)\s*(?:chambres?|ch\.?\b)/i)
  if (bedroomsMatch) {
    const bed = parseInt(bedroomsMatch[1])
    if (bed >= 1 && bed <= 10) {
      filters.bedrooms = bed >= 4 ? '4+' : String(bed)
      understood.push(`${bed} chambre${bed > 1 ? 's' : ''}`)
    }
  }

  // Price: "max 800k", "moins de 500000", "budget 1.2m", "max 2500/mois"
  const priceMax = q.match(/(?:max(?:imum)?|moins\s+de|budget|jusqu'?\s*[aà])\s*(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(k|m|'?\d*)/)
  if (priceMax) {
    let price = parseFloat(priceMax[1].replace(',', '.'))
    const unit = priceMax[2]?.toLowerCase()
    if (unit === 'k') price *= 1000
    else if (unit === 'm') price *= 1000000
    filters.maxPrice = String(Math.round(price))
    understood.push(`Max CHF ${price >= 1000000 ? `${price / 1000000}M` : price >= 1000 ? `${price / 1000}K` : price}`)
  }

  // Price min: "à partir de", "dès", "min"
  const priceMin = q.match(/(?:a\s+partir\s+de|des|minimum|min)\s*(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(k|m|'?\d*)/)
  if (priceMin) {
    let price = parseFloat(priceMin[1].replace(',', '.'))
    const unit = priceMin[2]?.toLowerCase()
    if (unit === 'k') price *= 1000
    else if (unit === 'm') price *= 1000000
    filters.minPrice = String(Math.round(price))
    understood.push(`Min CHF ${price >= 1000000 ? `${price / 1000000}M` : price >= 1000 ? `${price / 1000}K` : price}`)
  }

  // Standalone price (just a number with k/m): "800k", "1.5m"
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

  // Surface: "100m²", "min 80 m2"
  const surfaceMatch = q.match(/(?:min(?:imum)?\s*)?(\d+)\s*m[²2]/)
  if (surfaceMatch) {
    filters.minSurface = surfaceMatch[1]
    understood.push(`Min ${surfaceMatch[1]} m²`)
  }

  // City detection
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (original.includes(alias)) {
      filters.city = city
      understood.push(city)
      break
    }
  }

  // Canton detection (if no city was found)
  if (!filters.city) {
    // Check canton aliases ("genève" → GE, "vaud" → VD)
    for (const [alias, code] of Object.entries(CANTON_SEARCH_ALIASES)) {
      if (q.includes(alias)) {
        filters.canton = code
        understood.push(CANTON_LABELS[code] || code)
        break
      }
    }
    // Check direct 2-letter canton codes (e.g., "GE", "VD")
    if (!filters.canton) {
      const cantonMatch = original.match(/\b([A-Z]{2})\b/)
      if (cantonMatch && CANTON_LABELS[cantonMatch[1]]) {
        filters.canton = cantonMatch[1]
        understood.push(CANTON_LABELS[cantonMatch[1]])
      }
    }
  }

  // Property type detection
  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    if (original.includes(alias)) {
      filters.types = [type]
      understood.push(alias.charAt(0).toUpperCase() + alias.slice(1))
      break
    }
  }

  // Lifestyle tags detection
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

// ─── HELPERS ────────────────────────────────────────────────────────────────

function parseFiltersFromParams(params: URLSearchParams): Filters {
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
    view: (params.get('view') as ViewMode) || 'list',
  }
}

function filtersToParams(filters: Filters): Record<string, string> {
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
  if (filters.view !== 'list') p.view = filters.view
  return p
}

// Convertir les filtres UI → filtres serveur (MarketFilters)
function toServerFilters(filters: Filters): MarketFilters {
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

// ─── FILTER PILL DROPDOWN ───────────────────────────────────────────────────

interface FilterPillProps {
  label: string
  active: boolean
  dark?: boolean
  children: React.ReactNode
}

function FilterPill({ label, active, dark, children }: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
          dark
            ? active
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            : active
              ? 'bg-accent text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', active ? (dark ? 'text-white/60' : 'text-white/70') : 'text-gray-400', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1.5 max-h-72 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      )}
    </div>
  )
}

function FilterOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2',
        selected ? 'text-accent font-medium bg-accent/5' : 'text-gray-700'
      )}
      onClick={onClick}
    >
      <span className="flex-1">{children}</span>
      {selected && (
        <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

// ─── LISTING CARD (HORIZONTAL) ──────────────────────────────────────────────

function ListingCardHorizontal({
  listing,
  onHover,
  isHovered,
  isFavorite: isFav = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  medianPricePerM2 = 0,
  onPreview,
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  isCompared?: boolean
  onToggleCompare?: () => void
  medianPricePerM2?: number
  onPreview?: (id: string) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const photos = listing.photos?.length ? listing.photos : []

  // Scroll into view when hovered from map
  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const badge = getSmartBadge(listing, medianPricePerM2)

  return (
    <div
      ref={cardRef}
      onClick={() => onPreview?.(listing.id)}
      className={cn(
        'flex flex-col sm:flex-row bg-white border rounded-xl transition-all duration-200 overflow-hidden group cursor-pointer',
        isHovered
          ? 'border-accent/40 shadow-md ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      {/* Photo */}
      <div className="relative w-full sm:w-56 lg:w-64 shrink-0 aspect-[4/3] overflow-hidden sm:rounded-l-xl">
        {photos.length > 0 ? (
          <img
            src={photos[currentPhoto]}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

        {/* Badge — compact in list mode */}
        {badge && (
          <div className={cn(badge.bg, 'absolute top-2 left-2 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded backdrop-blur-sm')}>
            {badge.label}
          </div>
        )}

        {/* Favorite + Compare — horizontal row, smaller in list mode */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.() }}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'h-6 w-6 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isFav ? 'bg-white/95' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            <Heart className={cn('h-3 w-3 transition-colors', isFav ? 'fill-red-500 text-red-500' : 'text-white/90')} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCompare?.() }}
            aria-label={isCompared ? 'Retirer de la comparaison' : 'Comparer'}
            className={cn(
              'h-6 w-6 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isCompared ? 'bg-white/95 ring-1 ring-accent/40' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            {isCompared ? <Check className="h-2.5 w-2.5 text-accent" /> : <GitCompareArrows className="h-2.5 w-2.5 text-white/90" />}
          </button>
        </div>
        {/* Always show active icons */}
        {(isFav || isCompared) && (
          <div className="absolute top-2 right-2 flex gap-1 group-hover:hidden">
            {isFav && (
              <div className="h-6 w-6 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center">
                <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              </div>
            )}
            {isCompared && (
              <div className="h-6 w-6 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center ring-1 ring-accent/40">
                <Check className="h-2.5 w-2.5 text-accent" />
              </div>
            )}
          </div>
        )}

        {/* Photo arrows — smaller for list mode */}
        {photos.length > 1 && (
          <>
            {currentPhoto > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p - 1) }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-white" />
              </button>
            )}
            {currentPhoto < photos.length - 1 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p + 1) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </button>
            )}
          </>
        )}
        {/* Photo counter only (no dots in list mode — too small) */}
        {photos.length > 1 && (
          <span className="absolute bottom-2 left-2 text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-[1]">
            {currentPhoto + 1}/{photos.length}
          </span>
        )}
      </div>

      {/* Info — compact layout with gap-1, agent at bottom via mt-auto */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">
              <span className="text-sm font-normal text-gray-500">CHF </span>
              {formatCHF(listing.price).replace('CHF ', '')}{listing.context === 'rent' ? '/mois' : ''}
            </span>
            {listing.price_per_m2 && listing.price_per_m2 > 0 && (
              <span className="text-xs text-gray-400">
                {formatPricePerM2(listing.price_per_m2)}
              </span>
            )}
          </div>

          <p className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <span className="truncate">
              {listing.address}, {listing.city}
            </span>
          </p>

          <div className="flex items-center text-sm text-gray-500">
            {listing.rooms > 0 && (
              <span className="flex items-center gap-1">
                <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
                {listing.rooms} pièces
              </span>
            )}
            {listing.rooms > 0 && listing.bedrooms > 0 && <span className="text-gray-300 mx-1.5">·</span>}
            {listing.bedrooms > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-500" />
                {listing.bedrooms} ch.
              </span>
            )}
            {(listing.rooms > 0 || listing.bedrooms > 0) && <span className="text-gray-300 mx-1.5">·</span>}
            <span className="flex items-center gap-1">
              <Maximize className="h-3.5 w-3.5 text-gray-500" />
              {formatSurface(listing.surface_m2)}
            </span>
          </div>

          {/* Description preview */}
          {listing.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
              {listing.description}
            </p>
          )}

          {/* Nearest station */}
          {(() => {
            const station = findNearestStation(listing.lat, listing.lng)
            if (!station) return null
            return (
              <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Train className="h-3 w-3 text-gray-400 shrink-0" />
                {station.name} · {formatStationDistance(station.distanceM)}
              </p>
            )
          })()}
        </div>

        {/* Bottom line — agency + date */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 min-w-0">
            {listing.agent ? (
              <>
                <img
                  src={listing.agent.photo}
                  alt={listing.agent.name}
                  className="h-5 w-5 rounded-full object-cover shrink-0"
                />
                <span className="text-xs text-gray-400 truncate">
                  {listing.agent.name} · {listing.agent.agency}
                </span>
              </>
            ) : listing.agency_name ? (
              <span className="text-xs text-gray-400 truncate">{listing.agency_name}</span>
            ) : null}
          </div>
          {listing.published_at && (
            <span className="text-xs text-gray-400 shrink-0">
              {formatRelativeDate(listing.published_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── LISTING CARD (GRID) ────────────────────────────────────────────────────

function ListingCardGrid({
  listing,
  onHover,
  isHovered,
  isFavorite: isFav = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  medianPricePerM2 = 0,
  onPreview,
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  isCompared?: boolean
  onToggleCompare?: () => void
  medianPricePerM2?: number
  onPreview?: (id: string) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const photos = listing.photos?.length ? listing.photos : []

  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const badge = getSmartBadge(listing, medianPricePerM2)

  return (
    <div
      ref={cardRef}
      onClick={() => onPreview?.(listing.id)}
      className={cn(
        'block bg-white border rounded-xl transition-all duration-200 overflow-hidden group cursor-pointer',
        isHovered
          ? 'border-accent/40 ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {photos.length > 0 ? (
          <img
            src={photos[currentPhoto]}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Gradient for dot/counter visibility */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        {/* Badge */}
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm'
            )}
          >
            {badge.label}
          </div>
        )}
        {/* Favorite + Compare — smaller, more subtle */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.() }}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'h-7 w-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isFav ? 'bg-white/95' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            <Heart className={cn('h-3.5 w-3.5 transition-colors', isFav ? 'fill-red-500 text-red-500' : 'text-white/90')} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCompare?.() }}
            aria-label={isCompared ? 'Retirer de la comparaison' : 'Comparer'}
            className={cn(
              'h-7 w-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isCompared ? 'bg-white/95 ring-1 ring-accent/40' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            {isCompared ? <Check className="h-3 w-3 text-accent" /> : <GitCompareArrows className="h-3 w-3 text-white/90" />}
          </button>
        </div>
        {/* Always show if active (even without hover) */}
        {(isFav || isCompared) && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 group-hover:hidden">
            {isFav && (
              <div className="h-7 w-7 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center">
                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              </div>
            )}
            {isCompared && (
              <div className="h-7 w-7 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center ring-1 ring-accent/40">
                <Check className="h-3 w-3 text-accent" />
              </div>
            )}
          </div>
        )}
        {/* Photo arrows */}
        {photos.length > 1 && (
          <>
            {currentPhoto > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p - 1) }}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
            )}
            {currentPhoto < photos.length - 1 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p + 1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            )}
          </>
        )}
        {/* Photo dots + counter */}
        {photos.length > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-[1]">
              {photos.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCurrentPhoto(i)
                  }}
                  className={cn(
                    'rounded-full transition-all cursor-pointer',
                    currentPhoto === i ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'
                  )}
                />
              ))}
            </div>
            <span className="absolute bottom-3 right-3 text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-[1]">
              {currentPhoto + 1}/{photos.length}
            </span>
          </>
        )}
      </div>
      <div className="p-4">
        {/* Price + price/m² */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">
            <span className="text-sm font-normal text-gray-400">CHF </span>
            {formatCHF(listing.price).replace('CHF ', '')}{listing.context === 'rent' ? '/mois' : ''}
          </span>
          {listing.price_per_m2 && listing.price_per_m2 > 0 && listing.surface_m2 > 0 && (
            <span className="text-[11px] text-gray-400">
              CHF {Math.round(listing.price_per_m2).toLocaleString('fr-CH')}/m²
            </span>
          )}
        </div>
        {/* Address */}
        <p className="text-sm text-gray-500 mt-1 truncate">
          {listing.address}, {listing.city}
        </p>
        {/* Specs row */}
        <div className="flex items-center text-[13px] text-gray-500 mt-2 gap-1">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
              {listing.rooms} pièces
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-300 mx-0.5">·</span>
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-400" />
                {listing.bedrooms} ch.
              </span>
            </>
          )}
          <span className="text-gray-300 mx-0.5">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5 text-gray-400" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
        {/* Description preview */}
        {listing.description && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-1">{listing.description}</p>
        )}
        {/* Agency + freshness */}
        {(listing.agency_name || listing.days_on_market !== undefined) && (
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
            {listing.agency_name && (
              <span className="text-[11px] text-gray-400 truncate max-w-[60%]">{listing.agency_name}</span>
            )}
            {listing.days_on_market !== undefined && (
              <span className="text-[11px] text-gray-400">
                {listing.days_on_market <= 1 ? "Aujourd'hui" : listing.days_on_market <= 7 ? `il y a ${listing.days_on_market}j` : `${listing.days_on_market}j`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN SEARCH PAGE ───────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => parseFiltersFromParams(searchParams))
  const [hoveredListing, setHoveredListing] = useState<string>()
  const [showMobileMap, setShowMobileMap] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.q)
  const [aiUnderstood, setAiUnderstood] = useState<string[]>([])
  const [showAiBanner, setShowAiBanner] = useState(false)
  const [zoneFilterIds, setZoneFilterIds] = useState<string[] | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    // Restore from URL params first, then localStorage
    const urlCompare = searchParams.get('compare')
    if (urlCompare) return urlCompare.split(',').filter(Boolean).slice(0, 3)
    try {
      const stored = localStorage.getItem('megga-compare')
      return stored ? JSON.parse(stored).slice(0, 3) : []
    } catch { return [] }
  })
  const [showCompare, setShowCompare] = useState(false)
  const [compareToast, setCompareToast] = useState<string | null>(null)
  const [savedSearchToast] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savedListOpen, setSavedListOpen] = useState(false)
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites()
  const [previewId, setPreviewId] = useState<string | null>(() => searchParams.get('listing'))
  const mapViewRef = useRef<MapViewHandle>(null)
  const viewedIdsRef = useRef<Set<string>>(new Set())

  // Market temperature for current location filter
  const { data: marketTemp } = useMarketTemperature(filters.canton || undefined, filters.city || undefined)
  const medianPricePerM2 = marketTemp?.medianPricePerM2 || 0

  // Canton stats for mobile filter
  const { data: marketStats } = useMarketStats(filters.context)

  // Convertir filtres UI → filtres serveur
  const serverFilters = toServerFilters(filters)

  // Fetch listings paginées depuis Supabase (filtrage côté serveur)
  const {
    data: listingsData,
    isLoading: isLoadingListings,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMarketListings(serverFilters)

  // Fetch points carte (légers, tous les biens avec lat/lng)
  const { data: mapPoints } = useMapPoints(serverFilters)

  // Aplatir les pages en une seule liste
  const allListings = listingsData?.pages.flatMap((p) => p.listings) ?? []
  const totalCount = listingsData?.pages[0]?.totalCount ?? 0

  // Sync filters to URL
  useEffect(() => {
    const params = filtersToParams(filters)
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const openPreview = useCallback((id: string) => {
    setPreviewId(id)
    viewedIdsRef.current.add(id)
    const params = new URLSearchParams(window.location.search)
    params.set('listing', id)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }, [])
  const closePreview = useCallback(() => {
    setPreviewId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('listing')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  const updateFilter = useCallback(
    (patch: Partial<Filters>) => {
      setFilters((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  // Zone filter (polygon drawn on map)
  const filtered = zoneFilterIds
    ? allListings.filter((l) => zoneFilterIds.includes(l.id))
    : allListings

  // Recommendation sorting (client-side)
  const visible = filters.sort === 'recommended'
    ? sortByRecommendation(filtered, {
        favoriteIds,
        viewedIds: [...viewedIdsRef.current],
        savedSearchFilters: [],
      }, medianPricePerM2)
    : filtered
  const hasMore = hasNextPage ?? false

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.rooms !== '' ||
    filters.bedrooms !== '' ||
    filters.minSurface !== '' ||
    filters.city !== '' ||
    filters.canton !== '' ||
    filters.lifestyleTags.length > 0 ||
    filters.energyLabel !== ''

  const activeFilterCount = [
    filters.types.length > 0,
    filters.minPrice || filters.maxPrice,
    filters.rooms,
    filters.bedrooms,
    filters.minSurface,
    filters.city || filters.canton,
    filters.lifestyleTags.length > 0,
    filters.energyLabel,
  ].filter(Boolean).length

  function clearAllFilters() {
    updateFilter({
      types: [],
      minPrice: '',
      maxPrice: '',
      rooms: '',
      bedrooms: '',
      bathrooms: '',
      minSurface: '',
      city: '',
      canton: '',
      lifestyleTags: [],
      energyLabel: '',
      q: '',
    })
    setSearchInput('')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchInput.trim()) {
      updateFilter({ q: '' })
      setShowAiBanner(false)
      setAiUnderstood([])
      return
    }

    // Parse natural language query
    const parsed = parseNaturalLanguageQuery(searchInput)

    if (parsed.understood.length > 0) {
      // AI understood something → reset all filters then apply extracted ones
      const resetFilters: Partial<Filters> = {
        types: [],
        minPrice: '',
        maxPrice: '',
        rooms: '',
        minSurface: '',
        bedrooms: '',
        city: '',
        canton: '',
        lifestyleTags: [],
        q: '',
      }
      updateFilter({ ...resetFilters, ...parsed.filters })
      setAiUnderstood(parsed.understood)
      setShowAiBanner(true)
    } else {
      // Fallback: use as text search
      updateFilter({ q: searchInput })
      setShowAiBanner(false)
      setAiUnderstood([])
    }
  }

  // Chat AI filter callback
  const handleChatFilters = useCallback((chatFilters: Record<string, string | string[]>) => {
    const patch: Partial<Filters> = {}
    if (chatFilters.city) patch.city = chatFilters.city as string
    if (chatFilters.canton) patch.canton = chatFilters.canton as string
    if (chatFilters.rooms) patch.rooms = chatFilters.rooms as string
    if (chatFilters.maxPrice) patch.maxPrice = chatFilters.maxPrice as string
    if (chatFilters.minPrice) patch.minPrice = chatFilters.minPrice as string
    if (chatFilters.minSurface) patch.minSurface = chatFilters.minSurface as string
    if (chatFilters.bedrooms) patch.bedrooms = chatFilters.bedrooms as string
    if (Array.isArray(chatFilters.types)) patch.types = chatFilters.types
    if (chatFilters.context === 'rent') patch.context = 'rent'
    updateFilter(patch)
  }, [updateFilter])

  // Compare helpers — persist to localStorage + URL
  useEffect(() => {
    try { localStorage.setItem('megga-compare', JSON.stringify(compareIds)) } catch {}
    // Update URL param
    const sp = new URLSearchParams(searchParams)
    if (compareIds.length > 0) sp.set('compare', compareIds.join(','))
    else sp.delete('compare')
    setSearchParams(sp, { replace: true })
  }, [compareIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        setCompareToast('Maximum 3 biens en comparaison')
        setTimeout(() => setCompareToast(null), 2500)
        return prev
      }
      return [...prev, id]
    })
  }
  const compareListings = allListings.filter((l) => compareIds.includes(l.id))

  const priceRanges = filters.context === 'rent' ? PRICE_RANGES_RENT : PRICE_RANGES_BUY

  // Price pill label
  const pricePillLabel = (() => {
    if (filters.minPrice && filters.maxPrice) {
      return filters.context === 'rent'
        ? `CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")} – ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}/m`
        : `CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")} – ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    }
    if (filters.minPrice) return `Dès CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    if (filters.maxPrice) return `Max CHF ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    return 'Prix'
  })()

  return (
    <div className="h-screen flex flex-col bg-white">
      <Navbar />

      {/* ─── UNIFIED STICKY BAR: Search + Filters ─── */}
      <div className="sticky top-14 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="px-4 md:px-6">

          {/* Desktop: single unified row — constrained to left panel width */}
          <div className="hidden md:flex items-center gap-1.5 h-12 lg:max-w-[55%]">
            {/* Search input — flexible width */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 flex-1 min-w-[160px] max-w-[320px] transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-300">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ville, quartier, canton..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); clearAllFilters() }} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              )}
              {/* AI search button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowChat(true) }}
                className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer shrink-0"
                title="Recherche assistée par IA"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Type */}
            <FilterPill
              label={filters.types.length ? filters.types.map((t) => PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS] || t).join(', ') : 'Type'}
              active={filters.types.length > 0}
              dark
            >
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <FilterOption key={value} selected={filters.types.includes(value)} onClick={() => {
                  const next = filters.types.includes(value) ? filters.types.filter((t) => t !== value) : [...filters.types, value]
                  updateFilter({ types: next })
                }}>{label}</FilterOption>
              ))}
            </FilterPill>

            {/* Prix */}
            <FilterPill label={pricePillLabel} active={!!filters.minPrice || !!filters.maxPrice} dark>
              {priceRanges.map((range) => (
                <FilterOption key={range.label} selected={filters.minPrice === range.min && filters.maxPrice === range.max} onClick={() => updateFilter({ minPrice: range.min, maxPrice: range.max })}>{range.label}</FilterOption>
              ))}
              <FilterOption selected={!filters.minPrice && !filters.maxPrice} onClick={() => updateFilter({ minPrice: '', maxPrice: '' })}>Tous les prix</FilterOption>
            </FilterPill>

            {/* Pièces */}
            <FilterPill label={filters.rooms ? `${filters.rooms} pièces` : 'Pièces'} active={!!filters.rooms} dark>
              {ROOM_OPTIONS.map((r) => (
                <FilterOption key={r} selected={filters.rooms === r} onClick={() => updateFilter({ rooms: filters.rooms === r ? '' : r })}>{r} pièces</FilterOption>
              ))}
            </FilterPill>

            {/* "Plus" filter — wide panel with grid layout */}
            {(() => {
              const plusCount = [filters.minSurface, filters.bedrooms, filters.bathrooms, filters.lifestyleTags.length > 0, filters.energyLabel].filter(Boolean).length
              const plusActive = !!(filters.minSurface || filters.bedrooms || filters.bathrooms || filters.lifestyleTags.length || filters.energyLabel)
              return (
                <div className="relative" ref={(el) => {
                  // Close on outside click — reuse FilterPill pattern inline
                  if (!el) return
                  const handler = (e: MouseEvent) => {
                    if (!el.contains(e.target as Node)) setPlusOpen(false)
                  }
                  if (plusOpen) document.addEventListener('mousedown', handler)
                  return () => document.removeEventListener('mousedown', handler)
                }}>
                  <button
                    type="button"
                    onClick={() => setPlusOpen(!plusOpen)}
                    className={cn(
                      'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
                      plusActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {plusCount > 0 ? `Plus (${plusCount})` : 'Plus'}
                    <ChevronDown className={cn('w-3 h-3 transition-transform', plusActive ? 'text-white/60' : 'text-gray-400', plusOpen && 'rotate-180')} />
                  </button>
                  {plusOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-[420px] bg-white rounded-xl shadow-lg border border-gray-100 z-50 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left column */}
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Surface min.</p>
                          <div className="flex flex-wrap gap-1 mb-4">
                            {['30', '50', '80', '100', '150', '200'].map((s) => (
                              <button key={s} type="button" onClick={() => updateFilter({ minSurface: filters.minSurface === s ? '' : s })} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer', filters.minSurface === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {s} m²
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Chambres</p>
                          <div className="flex gap-1 mb-4">
                            {BEDROOM_OPTIONS.map((b) => (
                              <button key={`bed-${b}`} type="button" onClick={() => updateFilter({ bedrooms: filters.bedrooms === b ? '' : b })} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer', filters.bedrooms === b ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {b}
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Salles de bain</p>
                          <div className="flex gap-1 mb-4">
                            {BATHROOM_OPTIONS.map((b) => (
                              <button key={`bath-${b}`} type="button" onClick={() => updateFilter({ bathrooms: filters.bathrooms === b ? '' : b })} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer', filters.bathrooms === b ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {b}
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Énergie</p>
                          <div className="flex flex-wrap gap-1">
                            {ENERGY_OPTIONS.map((e) => (
                              <button key={e.value} type="button" onClick={() => updateFilter({ energyLabel: filters.energyLabel === e.value ? '' : e.value })} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer', filters.energyLabel === e.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {e.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Right column — lifestyle tags */}
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Style de vie</p>
                          <div className="flex flex-wrap gap-1">
                            {LIFESTYLE_TAGS.map((tag) => (
                              <button key={tag.value} type="button" onClick={() => {
                                const next = filters.lifestyleTags.includes(tag.value) ? filters.lifestyleTags.filter((t) => t !== tag.value) : [...filters.lifestyleTags, tag.value]
                                updateFilter({ lifestyleTags: next })
                              }} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer', filters.lifestyleTags.includes(tag.value) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Clear filters + Save search */}
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0" title="Effacer les filtres">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {hasActiveFilters && (
              <button
                onClick={() => setSaveDialogOpen(true)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                title="Sauvegarder cette recherche"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Sort pill */}
            <FilterPill
              label={SORT_OPTIONS.find(o => o.value === filters.sort)?.label || 'Pertinence'}
              active={filters.sort !== 'relevance'}
              dark
            >
              {SORT_OPTIONS.map((opt) => (
                <FilterOption key={opt.value} selected={filters.sort === opt.value} onClick={() => updateFilter({ sort: opt.value })}>{opt.label}</FilterOption>
              ))}
            </FilterPill>

            {/* View toggle */}
            <div className="flex items-center gap-0.5">
              <button onClick={() => updateFilter({ view: 'list' })} className={cn('p-1.5 rounded-md transition-colors cursor-pointer', filters.view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => updateFilter({ view: 'grid' })} className={cn('p-1.5 rounded-md transition-colors cursor-pointer', filters.view === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Result count */}
            <span className="text-xs font-bold text-gray-400 tabular-nums whitespace-nowrap">
              {totalCount > 0 ? totalCount.toLocaleString('fr-CH') : filtered.length} biens
            </span>
          </div>

          {/* Mobile: search + filter button */}
          <div className="md:hidden flex items-center gap-2 h-12">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 flex-1">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
              />
            </form>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer',
                hasActiveFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="h-4 w-4 bg-white text-gray-900 text-[10px] rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: filters + results */}
        <div className="w-full lg:w-[55%] flex flex-col overflow-hidden">
          {/* ─── AI Understanding Banner ─── */}
          {showAiBanner && aiUnderstood.length > 0 && (
            <div className="px-4 md:px-6 py-2 bg-accent/5 border-b border-accent/10 flex items-center gap-2 flex-wrap">
              <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-xs text-accent font-medium">Recherche IA :</span>
              {aiUnderstood.map((item, i) => (
                <span
                  key={i}
                  className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium"
                >
                  {item}
                </span>
              ))}
              <button
                onClick={() => {
                  clearAllFilters()
                  setShowAiBanner(false)
                  setAiUnderstood([])
                }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Effacer
              </button>
            </div>
          )}

          {/* Old ZONE 2 + mobile filter button removed — merged into unified bar above */}

          {/* Mobile filters drawer */}
          {showMobileFilters && (
            <div className="md:hidden px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                <FilterPill
                  label={filters.types.length ? 'Type ✓' : 'Type'}
                  active={filters.types.length > 0}
                >
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <FilterOption
                      key={value}
                      selected={filters.types.includes(value)}
                      onClick={() => {
                        const next = filters.types.includes(value)
                          ? filters.types.filter((t) => t !== value)
                          : [...filters.types, value]
                        updateFilter({ types: next })
                      }}
                    >
                      {label}
                    </FilterOption>
                  ))}
                </FilterPill>
                <FilterPill label={filters.rooms ? `${filters.rooms}p.` : 'Pièces'} active={!!filters.rooms}>
                  {ROOM_OPTIONS.map((r) => (
                    <FilterOption key={r} selected={filters.rooms === r} onClick={() => updateFilter({ rooms: filters.rooms === r ? '' : r })}>
                      {r} pièces
                    </FilterOption>
                  ))}
                </FilterPill>
                <FilterPill label={filters.canton ? (CANTON_LABELS[filters.canton] || filters.canton) : 'Canton'} active={!!filters.canton}>
                  {(marketStats?.cantonCounts || []).slice(0, 10).map(({ canton: c, count: cnt }) => (
                    <FilterOption key={c} selected={filters.canton === c} onClick={() => updateFilter({ canton: filters.canton === c ? '' : c, city: '' })}>
                      {CANTON_LABELS[c] || c} ({cnt})
                    </FilterOption>
                  ))}
                </FilterPill>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-gray-700 cursor-pointer">
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Old ZONE 3 results bar removed — sort/view/count merged into unified bar */}

          {/* ─── ZONE 4: Listing cards ─── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            {isLoadingListings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse w-2/3" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="h-12 w-12 text-gray-200 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-1">Aucun bien trouvé</p>
                <p className="text-sm text-gray-500 mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-accent font-medium hover:underline cursor-pointer"
                >
                  Effacer tous les filtres
                </button>
              </div>
            ) : filters.view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visible.map((listing) => (
                  <ListingCardGrid
                    key={listing.id}
                    listing={listing}
                    onHover={setHoveredListing}
                    isHovered={hoveredListing === listing.id}
                    isFavorite={isFavorite(listing.id)}
                    onToggleFavorite={() => toggleFavorite(listing.id)}
                    isCompared={compareIds.includes(listing.id)}
                    onToggleCompare={() => toggleCompare(listing.id)}
                    medianPricePerM2={medianPricePerM2}
                    onPreview={openPreview}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((listing) => (
                  <ListingCardHorizontal
                    key={listing.id}
                    listing={listing}
                    onHover={setHoveredListing}
                    isHovered={hoveredListing === listing.id}
                    isFavorite={isFavorite(listing.id)}
                    onToggleFavorite={() => toggleFavorite(listing.id)}
                    isCompared={compareIds.includes(listing.id)}
                    onToggleCompare={() => toggleCompare(listing.id)}
                    medianPricePerM2={medianPricePerM2}
                    onPreview={openPreview}
                  />
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-8">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-full hover:bg-accent hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Chargement...' : 'Charger plus de résultats'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── ZONE 5: Map (desktop) ─── */}
        <div className="hidden lg:block lg:w-[45%] sticky top-32 h-[calc(100vh-8rem)] border-l border-gray-200">
          <MapView
            ref={mapViewRef}
            listings={allListings}
            mapPoints={mapPoints}
            hoveredId={hoveredListing}
            onHover={setHoveredListing}
            onZoneFilter={setZoneFilterIds}
          />
        </div>
      </div>

      {/* Mobile: Map FAB */}
      <button
        onClick={() => setShowMobileMap(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
      >
        <Map className="h-4 w-4" />
        Voir la carte
      </button>

      {/* Mobile: Map overlay */}
      {showMobileMap && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <MapView
            listings={allListings}
            mapPoints={mapPoints}
            hoveredId={hoveredListing}
            onHover={setHoveredListing}
            onZoneFilter={setZoneFilterIds}
          />
          <button
            onClick={() => setShowMobileMap(false)}
            className="absolute top-4 right-4 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer z-10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}


      {/* ─── Compare floating bar ─── */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 h-12 px-5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg">
          <GitCompareArrows className="h-4 w-4" />
          <span>{compareIds.length} bien{compareIds.length > 1 ? 's' : ''} selectionne{compareIds.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCompare(true)}
            className="h-8 px-3 bg-accent rounded-full text-xs font-medium hover:bg-accent/90 transition-colors"
          >
            Comparer
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Compare drawer */}
      <CompareDrawer
        listings={compareListings}
        open={showCompare}
        onClose={() => setShowCompare(false)}
        onRemove={(id) => {
          setCompareIds((prev) => prev.filter((x) => x !== id))
          if (compareIds.length <= 1) setShowCompare(false)
        }}
      />

      {/* ─── Save search toast ─── */}
      {savedSearchToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg animate-in slide-in-from-top duration-200">
          <Check className="h-4 w-4 text-emerald-400" />
          Recherche sauvegardee
        </div>
      )}

      {/* Compare limit toast */}
      {compareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg animate-in slide-in-from-top duration-200">
          <GitCompareArrows className="h-4 w-4 text-amber-400" />
          {compareToast}
        </div>
      )}

      {/* ─── Listing preview panel (Zillow-style) ─── */}
      <ListingPreviewPanel
        listingId={previewId}
        onClose={closePreview}
        isCompared={previewId ? compareIds.includes(previewId) : false}
        onToggleCompare={previewId ? () => toggleCompare(previewId) : undefined}
      />

      {/* ─── Save search dialog ─── */}
      <SaveSearchDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        filters={filters}
        resultsCount={totalCount}
      />

      {/* ─── Saved searches list ─── */}
      <SavedSearchesList
        open={savedListOpen}
        onClose={() => setSavedListOpen(false)}
        onApplyFilters={(savedFilters) => {
          setFilters(prev => ({
            ...prev,
            ...savedFilters,
            sort: prev.sort,
            view: prev.view,
          }))
        }}
      />

      {/* ─── Conversational search (MEGGA AI) ─── */}
      <ChatSearch
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onApplyFilters={handleChatFilters}
        onHighlightListing={(id) => openPreview(id)}
        allListings={allListings}
      />
    </div>
  )
}
