import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  X,
  MapPin,
  Heart,
  Bell,
  LayoutGrid,
  List,
  DoorOpen,
  BedDouble,
  Maximize,
  Map,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import MapView from '@/components/map/MapView'
import SaveSearchModal from '@/components/search/SaveSearchModal'
import SavedSearchesPanel from '@/components/search/SavedSearchesPanel'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { MOCK_LISTINGS, toCardData } from '@/lib/mockData'
import { cn, formatCHF, formatSurface, formatRelativeDate } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS, CANTONS } from '@/lib/constants'
import type { ListingCardData } from '@/components/listings/ListingCard'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type Context = 'buy' | 'rent'
type ViewMode = 'list' | 'grid'
type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'surface_desc'

interface Filters {
  context: Context
  q: string
  types: string[]
  minPrice: string
  maxPrice: string
  rooms: string
  minSurface: string
  bedrooms: string
  city: string
  canton: string
  lifestyleTags: string[]
  sort: SortOption
  view: ViewMode
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ALL_LISTINGS = MOCK_LISTINGS.map(toCardData)

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'newest', label: 'Plus récent' },
  { value: 'surface_desc', label: 'Surface décroissante' },
]

const ROOM_OPTIONS = ['1', '2', '3', '4', '5+']
const BEDROOM_OPTIONS = ['1', '2', '3', '4+']

const LIFESTYLE_TAGS: { value: string; label: string; icon: string }[] = [
  { value: 'vue_lac', label: 'Vue lac', icon: '🌊' },
  { value: 'vue_montagne', label: 'Vue montagne', icon: '⛰️' },
  { value: 'lumineux', label: 'Lumineux', icon: '☀️' },
  { value: 'quartier_calme', label: 'Quartier calme', icon: '🤫' },
  { value: 'proche_transports', label: 'Transports', icon: '🚆' },
  { value: 'proche_ecoles', label: 'Écoles', icon: '🎓' },
  { value: 'terrasse', label: 'Terrasse', icon: '🌿' },
  { value: 'balcon', label: 'Balcon', icon: '🏗️' },
  { value: 'jardin', label: 'Jardin', icon: '🌳' },
  { value: 'parking', label: 'Parking', icon: '🅿️' },
  { value: 'piscine', label: 'Piscine', icon: '🏊' },
  { value: 'dernier_etage', label: 'Dernier étage', icon: '🔝' },
  { value: 'ascenseur', label: 'Ascenseur', icon: '🛗' },
  { value: 'meuble', label: 'Meublé', icon: '🛋️' },
  { value: 'centre_ville', label: 'Centre-ville', icon: '🏙️' },
]

const CITIES = [
  'Genève', 'Carouge', 'Lancy', 'Vernier', 'Meyrin', 'Cologny', 'Veyrier', 'Vandoeuvres',
  'Lausanne', 'Nyon', 'Montreux', 'Vevey',
]

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
    city: params.get('city') || '',
    canton: params.get('canton') || '',
    lifestyleTags: params.get('lifestyle')?.split(',').filter(Boolean) || [],
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
  if (filters.city) p.city = filters.city
  if (filters.canton) p.canton = filters.canton
  if (filters.lifestyleTags.length) p.lifestyle = filters.lifestyleTags.join(',')
  if (filters.sort !== 'relevance') p.sort = filters.sort
  if (filters.view !== 'list') p.view = filters.view
  return p
}

function applyFilters(listings: ListingCardData[], filters: Filters): ListingCardData[] {
  let result = listings.filter((l) => l.context === filters.context)

  if (filters.q) {
    const q = filters.q.toLowerCase()
    result = result.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        (l.description?.toLowerCase().includes(q) ?? false)
    )
  }

  if (filters.types.length) {
    result = result.filter((l) => l.type && filters.types.includes(l.type))
  }

  if (filters.minPrice) {
    result = result.filter((l) => l.price >= Number(filters.minPrice))
  }
  if (filters.maxPrice) {
    result = result.filter((l) => l.price <= Number(filters.maxPrice))
  }

  if (filters.rooms) {
    const minRooms = filters.rooms.endsWith('+')
      ? Number(filters.rooms.replace('+', ''))
      : Number(filters.rooms)
    result = result.filter((l) => l.rooms >= minRooms)
  }

  if (filters.bedrooms) {
    const minBed = filters.bedrooms.endsWith('+')
      ? Number(filters.bedrooms.replace('+', ''))
      : Number(filters.bedrooms)
    result = result.filter((l) => l.bedrooms >= minBed)
  }

  if (filters.minSurface) {
    result = result.filter((l) => l.surface_m2 >= Number(filters.minSurface))
  }

  if (filters.city) {
    result = result.filter((l) => l.city === filters.city)
  }
  if (filters.canton) {
    result = result.filter((l) => l.canton === filters.canton)
  }

  if (filters.lifestyleTags.length) {
    result = result.filter((l) =>
      filters.lifestyleTags.every((tag) => l.lifestyle_tags?.includes(tag))
    )
  }

  // Sort
  switch (filters.sort) {
    case 'price_asc':
      result.sort((a, b) => a.price - b.price)
      break
    case 'price_desc':
      result.sort((a, b) => b.price - a.price)
      break
    case 'newest':
      result.sort((a, b) => {
        const da = a.published_at ? new Date(a.published_at).getTime() : 0
        const db = b.published_at ? new Date(b.published_at).getTime() : 0
        return db - da
      })
      break
    case 'surface_desc':
      result.sort((a, b) => b.surface_m2 - a.surface_m2)
      break
    default:
      break
  }

  return result
}

// ─── FILTER PILL DROPDOWN ───────────────────────────────────────────────────

interface FilterPillProps {
  label: string
  active: boolean
  children: React.ReactNode
}

function FilterPill({ label, active, children }: FilterPillProps) {
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
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-center w-full px-3 py-1.5 text-xs rounded-full border transition-all duration-150 whitespace-nowrap cursor-pointer',
          active
            ? 'bg-accent text-white border-accent font-medium'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 ml-1 transition-transform', active ? 'text-white/70' : 'text-gray-400', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-lg shadow-dropdown border border-gray-100 z-20 py-1 max-h-60 overflow-y-auto">
            {children}
          </div>
        </>
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
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
}) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)

  // Scroll into view when hovered from map
  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const badge = listing.is_new
    ? { label: 'Nouveau', bg: 'bg-accent/90' }
    : listing.is_hot
      ? { label: 'Hot price', bg: 'bg-red-500/90' }
      : listing.is_exclusive
        ? { label: 'Exclusif', bg: 'bg-gray-900' }
        : listing.is_3d
          ? { label: '3D', bg: 'bg-purple-500' }
          : null

  const priceLabel =
    listing.context === 'rent' ? `${formatCHF(listing.price)}/mois` : formatCHF(listing.price)

  return (
    <Link
      ref={cardRef}
      to={`/listing/${listing.id}`}
      className={cn(
        'flex flex-col sm:flex-row bg-white border rounded-xl transition-all duration-200 overflow-hidden group',
        isHovered
          ? 'border-accent/40 shadow-card-hover ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-card-hover'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      {/* Photo */}
      <div className="relative w-full sm:w-56 lg:w-64 shrink-0 aspect-[4/3] overflow-hidden sm:rounded-l-xl">
        <img
          src={listing.photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Gradient for dot visibility */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Badge */}
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md'
            )}
          >
            {badge.label}
          </div>
        )}

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsFavorite(!isFavorite)
          }}
          className="absolute top-3 right-3 h-8 w-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white hover:scale-110 transition-all duration-200 cursor-pointer"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
            )}
          />
        </button>

        {/* Photo dots */}
        {listing.photos.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-[1]">
            {listing.photos.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentPhoto(i)
                }}
                className={cn(
                  'rounded-full transition-all cursor-pointer',
                  currentPhoto === i ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info — compact layout with gap-1, agent at bottom via mt-auto */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-primary-900">{priceLabel}</span>

          <p className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">
              {listing.address}, {listing.city}
            </span>
          </p>

          <div className="flex items-center text-sm text-gray-500">
            {listing.rooms > 0 && (
              <span className="flex items-center gap-1">
                <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
                {listing.rooms} pièces
              </span>
            )}
            {listing.rooms > 0 && listing.bedrooms > 0 && <span className="text-gray-300 mx-1.5">·</span>}
            {listing.bedrooms > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-400" />
                {listing.bedrooms} ch.
              </span>
            )}
            {(listing.rooms > 0 || listing.bedrooms > 0) && <span className="text-gray-300 mx-1.5">·</span>}
            <span className="flex items-center gap-1">
              <Maximize className="h-3.5 w-3.5 text-gray-400" />
              {formatSurface(listing.surface_m2)}
            </span>
          </div>
        </div>

        {/* Agent line — pushed to bottom */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {listing.agent && (
            <div className="flex items-center gap-1.5 min-w-0">
              <img
                src={listing.agent.photo}
                alt={listing.agent.name}
                className="h-5 w-5 rounded-full object-cover shrink-0"
              />
              <span className="text-xs text-gray-400 truncate">
                {listing.agent.name} · {listing.agent.agency}
              </span>
            </div>
          )}
          {listing.published_at && (
            <span className="text-xs text-gray-400 shrink-0">
              {formatRelativeDate(listing.published_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── LISTING CARD (GRID) ────────────────────────────────────────────────────

function ListingCardGrid({
  listing,
  onHover,
  isHovered,
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
}) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const badge = listing.is_new
    ? { label: 'Nouveau', bg: 'bg-accent/90' }
    : listing.is_hot
      ? { label: 'Hot price', bg: 'bg-red-500/90' }
      : listing.is_exclusive
        ? { label: 'Exclusif', bg: 'bg-gray-900' }
        : listing.is_3d
          ? { label: '3D', bg: 'bg-purple-500' }
          : null

  const priceLabel =
    listing.context === 'rent' ? `${formatCHF(listing.price)}/mois` : formatCHF(listing.price)

  return (
    <Link
      ref={cardRef}
      to={`/listing/${listing.id}`}
      className={cn(
        'block bg-white border rounded-xl transition-all duration-200 overflow-hidden group',
        isHovered
          ? 'border-accent/40 shadow-card-hover ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-card-hover'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Gradient for dot visibility */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md'
            )}
          >
            {badge.label}
          </div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsFavorite(!isFavorite)
          }}
          className="absolute top-3 right-3 h-8 w-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white hover:scale-110 transition-all duration-200 cursor-pointer"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
            )}
          />
        </button>
        {listing.photos.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-[1]">
            {listing.photos.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentPhoto(i)
                }}
                className={cn(
                  'rounded-full transition-all cursor-pointer',
                  currentPhoto === i ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div className="p-4">
        <span className="text-xl font-bold text-primary-900">{priceLabel}</span>
        <p className="text-sm text-gray-500 mt-1">
          {listing.address}, {listing.city}
        </p>
        <div className="flex items-center text-sm text-gray-500 mt-2">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
              {listing.rooms} p.
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-400" />
                {listing.bedrooms} ch.
              </span>
            </>
          )}
          <span className="text-gray-300 mx-1.5">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5 text-gray-400" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── MAIN SEARCH PAGE ───────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => parseFiltersFromParams(searchParams))
  const [hoveredListing, setHoveredListing] = useState<string>()
  const [visibleCount, setVisibleCount] = useState(10)
  const [showMobileMap, setShowMobileMap] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.q)
  const [aiUnderstood, setAiUnderstood] = useState<string[]>([])
  const [showAiBanner, setShowAiBanner] = useState(false)
  const [zoneFilterIds, setZoneFilterIds] = useState<string[] | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showSavedPanel, setShowSavedPanel] = useState(false)
  const [saveModalAlertDefault, setSaveModalAlertDefault] = useState(false)
  const { savedSearches } = useSavedSearches()

  // Sync filters to URL
  useEffect(() => {
    const params = filtersToParams(filters)
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const updateFilter = useCallback(
    (patch: Partial<Filters>) => {
      setFilters((prev) => ({ ...prev, ...patch }))
      setVisibleCount(10) // Reset pagination on filter change
    },
    []
  )

  const filteredByFilters = applyFilters(ALL_LISTINGS, filters)
  const filtered = zoneFilterIds
    ? filteredByFilters.filter((l) => zoneFilterIds.includes(l.id))
    : filteredByFilters
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.rooms !== '' ||
    filters.bedrooms !== '' ||
    filters.minSurface !== '' ||
    filters.city !== '' ||
    filters.canton !== '' ||
    filters.lifestyleTags.length > 0

  const activeFilterCount = [
    filters.types.length > 0,
    filters.minPrice || filters.maxPrice,
    filters.rooms,
    filters.bedrooms,
    filters.minSurface,
    filters.city || filters.canton,
    filters.lifestyleTags.length > 0,
  ].filter(Boolean).length

  function clearAllFilters() {
    updateFilter({
      types: [],
      minPrice: '',
      maxPrice: '',
      rooms: '',
      bedrooms: '',
      minSurface: '',
      city: '',
      canton: '',
      lifestyleTags: [],
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

      {/* ─── ZONE 1: Sticky search bar ─── */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-2.5">
          <div className="flex items-center gap-3">
            {/* Context tabs */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <button
                onClick={() => updateFilter({ context: 'buy' })}
                className={cn(
                  'px-4 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer',
                  filters.context === 'buy'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                Acheter
              </button>
              <button
                onClick={() => updateFilter({ context: 'rent' })}
                className={cn(
                  'px-4 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer',
                  filters.context === 'rent'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                Louer
              </button>
            </div>

            {/* Search bar with IA integration */}
            <form onSubmit={handleSearch} className="flex items-center gap-2.5 bg-white rounded-full px-3 py-1.5 border border-gray-200 shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all max-w-md w-full">
              <Sparkles className="h-4 w-4 text-accent/60 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher un bien, une ville..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
              />
              <button
                type="submit"
                className="w-8 h-8 bg-accent hover:bg-accent/90 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-white" />
              </button>
            </form>
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

          {/* ─── ZONE 2: Filter pills (desktop) ─── */}
          <div className="hidden md:block px-4 md:px-6 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              {/* Type */}
              <FilterPill
                label={
                  filters.types.length
                    ? filters.types.map((t) => PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS] || t).join(', ')
                    : 'Type de bien'
                }
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

              {/* Price */}
              <FilterPill label={pricePillLabel} active={!!filters.minPrice || !!filters.maxPrice}>
                {priceRanges.map((range) => (
                  <FilterOption
                    key={range.label}
                    selected={filters.minPrice === range.min && filters.maxPrice === range.max}
                    onClick={() => updateFilter({ minPrice: range.min, maxPrice: range.max })}
                  >
                    {range.label}
                  </FilterOption>
                ))}
                <FilterOption
                  selected={!filters.minPrice && !filters.maxPrice}
                  onClick={() => updateFilter({ minPrice: '', maxPrice: '' })}
                >
                  Tous les prix
                </FilterOption>
              </FilterPill>

              {/* Rooms */}
              <FilterPill
                label={filters.rooms ? `${filters.rooms} pièces` : 'Pièces'}
                active={!!filters.rooms}
              >
                {ROOM_OPTIONS.map((r) => (
                  <FilterOption
                    key={r}
                    selected={filters.rooms === r}
                    onClick={() => updateFilter({ rooms: filters.rooms === r ? '' : r })}
                  >
                    {r} pièces
                  </FilterOption>
                ))}
              </FilterPill>

              {/* Surface */}
              <FilterPill
                label={filters.minSurface ? `Dès ${filters.minSurface} m²` : 'Surface min'}
                active={!!filters.minSurface}
              >
                {['30', '50', '80', '100', '150', '200'].map((s) => (
                  <FilterOption
                    key={s}
                    selected={filters.minSurface === s}
                    onClick={() => updateFilter({ minSurface: filters.minSurface === s ? '' : s })}
                  >
                    Dès {s} m²
                  </FilterOption>
                ))}
              </FilterPill>

              {/* Bedrooms */}
              <FilterPill
                label={filters.bedrooms ? `${filters.bedrooms} ch.` : 'Chambres'}
                active={!!filters.bedrooms}
              >
                {BEDROOM_OPTIONS.map((b) => (
                  <FilterOption
                    key={b}
                    selected={filters.bedrooms === b}
                    onClick={() => updateFilter({ bedrooms: filters.bedrooms === b ? '' : b })}
                  >
                    {b} chambres
                  </FilterOption>
                ))}
              </FilterPill>

              {/* City / Canton */}
              <FilterPill
                label={filters.city || filters.canton || 'Localisation'}
                active={!!filters.city || !!filters.canton}
              >
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">Villes</div>
                {CITIES.map((c) => (
                  <FilterOption
                    key={c}
                    selected={filters.city === c}
                    onClick={() => updateFilter({ city: filters.city === c ? '' : c, canton: '' })}
                  >
                    {c}
                  </FilterOption>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">Cantons</div>
                  {CANTONS.slice(0, 8).map((canton) => (
                    <FilterOption
                      key={canton}
                      selected={filters.canton === canton}
                      onClick={() => updateFilter({ canton: filters.canton === canton ? '' : canton, city: '' })}
                    >
                      {canton}
                    </FilterOption>
                  ))}
                </div>
              </FilterPill>

              {/* Lifestyle tags */}
              <FilterPill
                label={filters.lifestyleTags.length ? `Style de vie (${filters.lifestyleTags.length})` : 'Style de vie'}
                active={filters.lifestyleTags.length > 0}
              >
                {LIFESTYLE_TAGS.map((tag) => (
                  <FilterOption
                    key={tag.value}
                    selected={filters.lifestyleTags.includes(tag.value)}
                    onClick={() => {
                      const next = filters.lifestyleTags.includes(tag.value)
                        ? filters.lifestyleTags.filter((t) => t !== tag.value)
                        : [...filters.lifestyleTags, tag.value]
                      updateFilter({ lifestyleTags: next })
                    }}
                  >
                    <span className="mr-0.5 text-sm">{tag.icon}</span> {tag.label}
                  </FilterOption>
                ))}
              </FilterPill>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-gray-400 hover:text-primary-900 transition-colors cursor-pointer ml-2 whitespace-nowrap"
                >
                  Effacer tout
                </button>
              )}
            </div>
          </div>

          {/* Mobile: filter button */}
          <div className="md:hidden px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={() => updateFilter({ context: filters.context === 'buy' ? 'rent' : 'buy' })}
              className="px-3 py-1.5 text-sm rounded-full bg-gray-900 text-white font-medium cursor-pointer"
            >
              {filters.context === 'buy' ? 'Acheter' : 'Louer'}
            </button>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-700 cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="h-5 w-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

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
                <FilterPill label={filters.city || 'Ville'} active={!!filters.city}>
                  {CITIES.map((c) => (
                    <FilterOption key={c} selected={filters.city === c} onClick={() => updateFilter({ city: filters.city === c ? '' : c })}>
                      {c}
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

          {/* ─── ZONE 3: Results bar ─── */}
          <div className="px-4 md:px-6 py-2.5 flex items-center justify-between border-b border-gray-100">
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-primary-900">{filtered.length}</span> bien{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {filters.city ? ` à ${filters.city}` : filters.canton ? ` (${filters.canton})` : ''}
            </span>

            <div className="flex items-center">
              {/* Sort */}
              <div className="hidden sm:block">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter({ sort: e.target.value as SortOption })}
                  className="text-sm text-gray-600 bg-transparent border-none outline-none cursor-pointer pr-6"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Separator */}
              <div className="hidden md:block border-l border-gray-200 h-5 mx-3" />

              {/* View toggle (desktop only) */}
              <div className="hidden md:flex items-center gap-0.5">
                <button
                  onClick={() => updateFilter({ view: 'list' })}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    filters.view === 'list' ? 'bg-gray-100 text-primary-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => updateFilter({ view: 'grid' })}
                  className={cn(
                    'p-1.5 rounded-md transition-colors cursor-pointer',
                    filters.view === 'grid' ? 'bg-gray-100 text-primary-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* Separator */}
              <div className="hidden sm:block border-l border-gray-200 h-5 mx-3" />

              {/* Save & Alert */}
              <button
                onClick={() => {
                  setSaveModalAlertDefault(false)
                  setShowSaveModal(true)
                }}
                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-900 transition-colors cursor-pointer mr-3 relative"
              >
                <Heart className="h-4 w-4" />
                Sauvegarder
                {savedSearches.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {savedSearches.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setSaveModalAlertDefault(true)
                  setShowSaveModal(true)
                }}
                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-900 transition-colors cursor-pointer mr-3"
              >
                <Bell className="h-4 w-4" />
                Alerte
              </button>
              {savedSearches.length > 0 && (
                <button
                  onClick={() => setShowSavedPanel(true)}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-accent font-medium hover:text-accent/80 transition-colors cursor-pointer"
                >
                  Mes recherches
                </button>
              )}
            </div>
          </div>

          {/* ─── ZONE 4: Listing cards ─── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            {filtered.length === 0 ? (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visible.map((listing) => (
                  <ListingCardGrid
                    key={listing.id}
                    listing={listing}
                    onHover={setHoveredListing}
                    isHovered={hoveredListing === listing.id}
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
                  />
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-8">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-full hover:bg-accent hover:text-white transition-colors cursor-pointer"
                >
                  Charger plus de résultats ({filtered.length - visibleCount} restants)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── ZONE 5: Map (desktop) ─── */}
        <div className="hidden lg:block lg:w-[45%] sticky top-32 h-[calc(100vh-8rem)] border-l border-gray-200">
          <MapView
            listings={filteredByFilters}
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
            listings={filteredByFilters}
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

      {/* Save search modal */}
      <SaveSearchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        filters={filters}
        resultsCount={filtered.length}
        defaultAlertEnabled={saveModalAlertDefault}
      />

      {/* Saved searches panel */}
      <SavedSearchesPanel
        isOpen={showSavedPanel}
        onClose={() => setShowSavedPanel(false)}
        onApply={(savedFilters) => {
          const f = savedFilters as unknown as Filters
          setFilters(f)
          setSearchInput(f.q || '')
        }}
      />
    </div>
  )
}
