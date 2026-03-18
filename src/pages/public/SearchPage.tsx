import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  ArrowRight,
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
  Expand,
  Send,
  SlidersHorizontal,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
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
  if (filters.sort !== 'relevance') p.sort = filters.sort
  if (filters.view !== 'list') p.view = filters.view
  return p
}

function formatPriceShort(price: number, context: Context): string {
  if (context === 'rent') return `${formatCHF(price)}/m`
  if (price >= 1000000) {
    const m = price / 1000000
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
  }
  return `${Math.round(price / 1000)}K`
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap cursor-pointer',
          active
            ? 'bg-accent text-white border-accent font-medium'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        )}
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white rounded-xl shadow-dropdown border border-gray-100 z-20 py-1.5 max-h-64 overflow-y-auto">
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
        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer',
        selected ? 'text-accent font-medium bg-blue-50' : 'text-gray-700'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ─── CHAT PANEL ─────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  suggestions?: string[]
  miniCards?: { id: string; title: string; price: number; context: Context }[]
}

function ChatPanel({
  open,
  onClose,
  context,
}: {
  open: boolean
  onClose: () => void
  context: Context
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour ! Je peux vous aider à affiner votre recherche. Décrivez ce que vous cherchez ou posez-moi une question sur les résultats affichés.',
      suggestions: ['Biens avec vue lac', 'Moins de CHF 500K', 'Proche des transports'],
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  function handleSend(text: string) {
    if (!text.trim()) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    setTimeout(() => {
      const mockCards =
        context === 'buy'
          ? [
              { id: '1', title: 'Appartement lumineux aux Eaux-Vives', price: 720000, context: 'buy' as Context },
              { id: '4', title: 'Villa avec vue sur le lac', price: 2950000, context: 'buy' as Context },
            ]
          : [
              { id: '20', title: 'Appartement vue lac Montreux', price: 2200, context: 'rent' as Context },
              { id: '24', title: 'Attique avec terrasse Carouge', price: 3200, context: 'rent' as Context },
            ]
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `J'ai trouvé ${mockCards.length} biens qui correspondent à votre demande. Voici les meilleurs :`,
        miniCards: mockCards,
      }
      setMessages((prev) => [...prev, reply])
      setTyping(false)
    }, 1500)
  }

  return (
    <>
      {/* Backdrop mobile */}
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />}

      <div
        className={cn(
          'fixed z-50 bg-white shadow-modal flex flex-col transition-transform duration-300',
          // Desktop: side panel
          'right-0 top-0 h-full w-96 max-lg:hidden',
          open ? 'translate-x-0' : 'translate-x-full',
          // Mobile: bottom drawer
          'max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:w-full max-lg:h-[85vh] max-lg:rounded-t-2xl',
          open ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
            <span className="font-semibold text-gray-900">Assistant MEGGA</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-2xl rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
                )}
              >
                <p>{msg.content}</p>

                {msg.suggestions && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {msg.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {msg.miniCards && (
                  <div className="space-y-2 mt-2.5">
                    {msg.miniCards.map((card) => (
                      <Link
                        key={card.id}
                        to={`/listing/${card.id}`}
                        className="block bg-white rounded-lg border border-gray-200 px-3 py-2 hover:border-accent transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">{card.title}</p>
                        <p className="text-xs font-bold text-accent mt-0.5">
                          {formatCHF(card.price)}
                          {card.context === 'rent' ? '/mois' : ''}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend(input)
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Décrivez ce que vous cherchez..."
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <button
              type="submit"
              className="h-10 w-10 bg-accent hover:bg-accent/90 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── LISTING CARD (HORIZONTAL) ──────────────────────────────────────────────

function ListingCardHorizontal({
  listing,
  onHover,
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
}) {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)

  const badge = listing.is_new
    ? { label: 'Nouveau', bg: 'bg-accent' }
    : listing.is_hot
      ? { label: 'Hot price', bg: 'bg-danger' }
      : listing.is_exclusive
        ? { label: 'Exclusif', bg: 'bg-gray-900' }
        : listing.is_3d
          ? { label: '3D', bg: 'bg-purple-500' }
          : null

  const priceLabel =
    listing.context === 'rent' ? `${formatCHF(listing.price)}/mois` : formatCHF(listing.price)

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="flex flex-col sm:flex-row bg-white rounded-card shadow-card hover:shadow-card-hover transition-all duration-200 hover:scale-[1.01] overflow-hidden group"
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      {/* Photo */}
      <div className="relative w-full sm:w-64 shrink-0 aspect-[4/3] overflow-hidden">
        <img
          src={listing.photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge */}
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-xs font-medium px-2 py-0.5 rounded-badge'
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
          className="absolute top-3 right-3 h-8 w-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-danger text-danger' : 'text-gray-600'
            )}
          />
        </button>

        {/* Photo dots */}
        {listing.photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {listing.photos.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentPhoto(i)
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all cursor-pointer',
                  currentPhoto === i ? 'w-3 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xl font-bold text-gray-900">{priceLabel}</span>
        </div>

        <p className="flex items-center gap-1 text-sm text-gray-500 mb-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {listing.address}, {listing.city}
          </span>
        </p>

        <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" />
              {listing.rooms} pièces
            </span>
          )}
          {listing.rooms > 0 && listing.bedrooms > 0 && <span className="text-gray-200">·</span>}
          {listing.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {listing.bedrooms} ch.
            </span>
          )}
          {(listing.rooms > 0 || listing.bedrooms > 0) && <span className="text-gray-200">·</span>}
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>

        {listing.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-auto">{listing.description}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
          {listing.agent && (
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={listing.agent.photo}
                alt={listing.agent.name}
                className="h-6 w-6 rounded-full object-cover shrink-0"
              />
              <span className="text-xs text-gray-400 truncate">
                {listing.agent.name} · {listing.agent.agency}
              </span>
            </div>
          )}
          {listing.published_at && (
            <span className="text-xs text-gray-400 shrink-0">
              Publié {formatRelativeDate(listing.published_at)}
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
}: {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
}) {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)

  const badge = listing.is_new
    ? { label: 'Nouveau', bg: 'bg-accent' }
    : listing.is_hot
      ? { label: 'Hot price', bg: 'bg-danger' }
      : listing.is_exclusive
        ? { label: 'Exclusif', bg: 'bg-gray-900' }
        : listing.is_3d
          ? { label: '3D', bg: 'bg-purple-500' }
          : null

  const priceLabel =
    listing.context === 'rent' ? `${formatCHF(listing.price)}/mois` : formatCHF(listing.price)

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="block bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden group"
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-xs font-medium px-2 py-0.5 rounded-badge'
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
          className="absolute top-3 right-3 h-9 w-9 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-danger text-danger' : 'text-gray-600'
            )}
          />
        </button>
        {listing.photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {listing.photos.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentPhoto(i)
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all cursor-pointer',
                  currentPhoto === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div className="p-4">
        <span className="text-xl font-bold text-gray-900">{priceLabel}</span>
        <p className="text-sm text-gray-500 mt-1">
          {listing.address}, {listing.city}
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-400 mt-2">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" />
              {listing.rooms} p.
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-200">·</span>
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" />
                {listing.bedrooms} ch.
              </span>
            </>
          )}
          <span className="text-gray-200">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── MAP PLACEHOLDER ────────────────────────────────────────────────────────

function MapPlaceholder({
  listings,
  hoveredId,
  context,
}: {
  listings: ListingCardData[]
  hoveredId?: string
  context: Context
}) {
  // Simulated pin positions (percentage-based)
  const pins = listings.slice(0, 12).map((l, i) => ({
    id: l.id,
    price: l.price,
    label: formatPriceShort(l.price, context),
    top: 15 + ((i * 37 + i * i * 11) % 65),
    left: 10 + ((i * 29 + i * 13) % 75),
  }))

  return (
    <div className="relative w-full h-full bg-blue-50/50 overflow-hidden">
      {/* Grid pattern to simulate map */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Simulated roads */}
      <div className="absolute top-[30%] left-0 right-0 h-px bg-gray-200" />
      <div className="absolute top-[60%] left-0 right-0 h-px bg-gray-200" />
      <div className="absolute left-[40%] top-0 bottom-0 w-px bg-gray-200" />
      <div className="absolute left-[70%] top-0 bottom-0 w-px bg-gray-200" />

      {/* Water area (simulated lake) */}
      <div className="absolute top-0 right-0 w-[35%] h-[40%] bg-blue-100/60 rounded-bl-[80px]" />

      {/* Price pins */}
      {pins.map((pin) => (
        <div
          key={pin.id}
          className={cn(
            'absolute flex items-center justify-center rounded-full border shadow-sm text-xs font-bold transition-all duration-200 cursor-pointer',
            hoveredId === pin.id
              ? 'bg-accent text-white border-accent scale-110 z-10'
              : 'bg-white text-gray-900 border-gray-200 hover:border-accent hover:text-accent'
          )}
          style={{
            top: `${pin.top}%`,
            left: `${pin.left}%`,
            minWidth: '56px',
            height: '28px',
            padding: '0 8px',
          }}
        >
          {pin.label}
        </div>
      ))}

      {/* Center message */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center shadow-sm border border-gray-100">
          <Map className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Carte interactive bientôt disponible</p>
          <button className="mt-2 text-xs text-accent font-medium flex items-center gap-1 mx-auto pointer-events-auto cursor-pointer hover:underline">
            <Expand className="h-3 w-3" />
            Voir en plein écran
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN SEARCH PAGE ───────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => parseFiltersFromParams(searchParams))
  const [hoveredListing, setHoveredListing] = useState<string>()
  const [chatOpen, setChatOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const [showMobileMap, setShowMobileMap] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.q)

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

  const filtered = applyFilters(ALL_LISTINGS, filters)
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
    filters.canton !== ''

  const activeFilterCount = [
    filters.types.length > 0,
    filters.minPrice || filters.maxPrice,
    filters.rooms,
    filters.bedrooms,
    filters.minSurface,
    filters.city || filters.canton,
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
      q: '',
    })
    setSearchInput('')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateFilter({ q: searchInput })
  }

  const contextLabel = filters.context === 'rent' ? 'location' : 'achat'
  const locationLabel = filters.city || filters.canton || 'Suisse'
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
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Context tabs */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <button
                onClick={() => updateFilter({ context: 'buy' })}
                className={cn(
                  'px-4 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer',
                  filters.context === 'buy'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Louer
              </button>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 flex items-center gap-1 bg-gray-50 rounded-xl px-3 border border-gray-200 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all">
              <MessageSquare className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher un bien, une ville, un quartier..."
                className="flex-1 text-sm bg-transparent py-2.5 outline-none text-gray-900 placeholder-gray-400 min-w-0"
              />
              <button
                type="submit"
                className="h-8 w-8 bg-accent hover:bg-accent/90 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <ArrowRight className="h-4 w-4 text-white" />
              </button>
            </form>

            {/* Context label */}
            <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
              <span>
                Résultats {contextLabel} — {locationLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: filters + results */}
        <div className="w-full lg:w-[55%] flex flex-col overflow-hidden">
          {/* ─── ZONE 2: Filter pills (desktop) ─── */}
          <div className="hidden md:block px-4 md:px-6 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2 flex-wrap">
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

              {/* More filters placeholder */}
              <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Plus de filtres
              </button>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer ml-auto"
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
                {/* Simplified mobile filters */}
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
          <div className="px-4 md:px-6 py-3 flex items-center justify-between border-b border-gray-50">
            <span className="text-sm font-medium text-gray-900">
              {filtered.length} bien{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {filters.city ? ` à ${filters.city}` : filters.canton ? ` (${filters.canton})` : ''}
            </span>

            <div className="flex items-center gap-3">
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

              {/* View toggle (desktop only) */}
              <div className="hidden md:flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => updateFilter({ view: 'list' })}
                  className={cn(
                    'p-1.5 transition-colors cursor-pointer',
                    filters.view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => updateFilter({ view: 'grid' })}
                  className={cn(
                    'p-1.5 transition-colors cursor-pointer',
                    filters.view === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* Save & Alert placeholders */}
              <button
                onClick={() => alert('Bientôt disponible')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Heart className="h-3.5 w-3.5" />
                Sauvegarder
              </button>
              <button
                onClick={() => alert('Bientôt disponible')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerte
              </button>
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
        <div className="hidden lg:block lg:w-[45%] sticky top-32">
          <MapPlaceholder
            listings={filtered}
            hoveredId={hoveredListing}
            context={filters.context}
          />
        </div>
      </div>

      {/* Mobile: Map FAB */}
      <button
        onClick={() => setShowMobileMap(true)}
        className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
      >
        <Map className="h-4 w-4" />
        Voir la carte
      </button>

      {/* Mobile: Map overlay */}
      {showMobileMap && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <MapPlaceholder listings={filtered} context={filters.context} />
          <button
            onClick={() => setShowMobileMap(false)}
            className="absolute top-4 right-4 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ─── ZONE 6: Chat IA ─── */}
      <button
        onClick={() => setChatOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-accent text-white rounded-full shadow-lg px-4 py-3 hover:shadow-xl transition-all cursor-pointer',
          chatOpen && 'hidden'
        )}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">Affiner ma recherche</span>
      </button>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} context={filters.context} />
    </div>
  )
}
