import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  MapPin, BedDouble, Bath, Maximize2, Heart, Share2,
  Phone, CalendarDays, Building2, Home,
  Clock, Star, Images, Fence, Sun, Archive, Car, Warehouse,
  ArrowUpDown, Mountain, Flame, Wind, TreePine, Droplets, Check,
  LayoutGrid,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { useMarketListing } from '@/hooks/useMarketListings'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { applyPlaceholders } from '@/lib/placeholderData'
import MarketTemperatureBadge from '@/components/listings/MarketTemperatureBadge'
import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import NaturalHazardBadge from '@/components/listings/NaturalHazardBadge'
import { useMarketTemperature } from '@/hooks/useMarketInsights'
import NeighborhoodSection from '@/components/listing/NeighborhoodSection'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ─── Types ──────────────────────────────────────────────────────────────

interface ListingPreviewPanelProps {
  listingId: string | null
  onClose: () => void
}

interface TransformedListing {
  id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  postal_code: string
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  photos: string[]
  description: string
  features: string[]
  type: string
  charges_monthly: number
  price_per_m2: number
  days_on_market: number
  is_hot: boolean
  is_new: boolean
  is_exclusive: boolean
  agency_name: string
  lat: number | undefined
  lng: number | undefined
  year_built: number
  floor: number
  condition: string
  has_parking: boolean
  has_outdoor: boolean
}

// ─── Transform helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformListing(data: Record<string, any>, source: 'market' | 'internal'): TransformedListing {
  return {
    id: data.id,
    title: data.title || 'Bien immobilier',
    price: Number(data.current_price ?? data.price ?? 0),
    address: data.address || '',
    city: data.city || '',
    canton: data.canton || '',
    postal_code: data.postal_code || '',
    rooms: Number(data.rooms) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    surface_m2: Number(data.surface_m2) || 0,
    photos: (data.photos as string[]) || [],
    description: (data.description as string) || '',
    features: (data.features as string[]) || [],
    type: (data.type as string) || 'apartment',
    charges_monthly: Number(data.charges_monthly) || 0,
    price_per_m2: source === 'market' ? Number(data.price_per_m2) || 0 : 0,
    days_on_market: source === 'market' ? Number(data.days_on_market) || 0 : 0,
    is_hot: source === 'market' ? data.status === 'price_reduced' : false,
    is_new: source === 'market' ? Number(data.days_on_market) <= 3 : false,
    is_exclusive: source === 'internal',
    agency_name: source === 'market' ? ((data.agency_name as string) || '') : 'MEGGA Real Estate',
    lat: data.lat as number | undefined,
    lng: data.lng as number | undefined,
    year_built: Number(data.year_built) || 0,
    floor: Number(data.floor) || 0,
    condition: (data.condition as string) || '',
    has_parking: !!data.has_parking,
    has_outdoor: !!data.has_outdoor,
  }
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  commercial: 'Commercial',
  land: 'Terrain',
  flat: 'Appartement',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Neuf',
  renovated: 'Rénové',
  good: 'Bon état',
  to_renovate: 'À rénover',
}

// ─── Feature icon mapping ───────────────────────────────────────────────

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  balcon: Fence,
  terrasse: Sun,
  cave: Archive,
  buanderie: Droplets,
  parking: Car,
  garage: Warehouse,
  ascenseur: ArrowUpDown,
  vue_lac: Droplets,
  vue_montagne: Mountain,
  jardin: TreePine,
  piscine: Droplets,
  cheminée: Flame,
  climatisation: Wind,
  balcony: Fence,
  terrace: Sun,
  cellar: Archive,
  laundry: Droplets,
  elevator: ArrowUpDown,
  lake_view: Droplets,
  mountain_view: Mountain,
  garden: TreePine,
  pool: Droplets,
  fireplace: Flame,
  ac: Wind,
}

function getFeatureIcon(feature: string) {
  const key = feature.toLowerCase().replace(/[\s-]/g, '_')
  for (const [k, icon] of Object.entries(FEATURE_ICONS)) {
    if (key.includes(k)) return icon
  }
  return Check
}

// ─── Section tabs ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'preview-overview', label: 'Aperçu' },
  { id: 'preview-details', label: 'Détails' },
  { id: 'preview-map', label: 'Localisation' },
  { id: 'preview-quartier', label: 'Quartier' },
  { id: 'preview-market', label: 'Marché' },
]

function SectionNav({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="flex gap-1 px-6 overflow-x-auto scrollbar-hide -mb-px">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative',
              activeId === s.id
                ? 'text-gray-900 bg-gray-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
            )}
          >
            {s.label}
            {s.id === 'preview-market' && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-accent/10 text-accent">Nouveau</span>
            )}
            {activeId === s.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Lightbox ───────────────────────────────────────────────────────────

function Lightbox({
  photos, open, index, onClose, onIndexChange,
}: {
  photos: string[]
  open: boolean
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1)
  }, [index, photos.length, onIndexChange])

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1)
  }, [index, onIndexChange])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, goNext, goPrev])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-white/80 text-sm font-medium">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 relative">
        <img
          src={photos[index]}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto scrollbar-hide">
        {photos.map((photo, i) => (
          <button
            key={i}
            onClick={() => onIndexChange(i)}
            className={cn(
              'h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
              index === i ? 'border-white opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
            )}
          >
            <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ─── Visit date picker (hidden by default, shown on CTA click) ──────────

function VisitDatePicker({ onCancel }: { onCancel: () => void }) {
  const [selectedDay, setSelectedDay] = useState(0)
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  })
  const dayNames = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
  const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prochaines disponibilités</p>
      <div className="grid grid-cols-3 gap-2">
        {days.slice(0, 3).map((d, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={cn(
              'flex flex-col items-center py-2.5 rounded-xl border text-center transition-all',
              selectedDay === i
                ? 'border-accent bg-accent/5 text-accent'
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            )}
          >
            <span className="text-[10px] font-medium uppercase">{dayNames[d.getDay()]}</span>
            <span className="text-lg font-bold">{d.getDate()}</span>
            <span className="text-[10px] text-gray-400">{monthNames[d.getMonth()]}</span>
          </button>
        ))}
      </div>
      <select className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
        <option>10:00</option>
        <option>11:00</option>
        <option>14:00</option>
        <option>15:00</option>
        <option>16:00</option>
        <option>17:00</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-10 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:border-gray-300 transition-colors"
        >
          Annuler
        </button>
        <button className="flex-1 h-10 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors">
          Confirmer
        </button>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────

export default function ListingPreviewPanel({ listingId, onClose }: ListingPreviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const mobileCarouselRef = useRef<HTMLDivElement>(null)

  const rawId = listingId?.replace('market-', '').replace('internal-', '')
  const isMarket = listingId?.startsWith('market-')
  const isInternal = listingId?.startsWith('internal-')

  const { data: marketData, isLoading: loadingMarket } = useMarketListing(isMarket ? rawId : undefined)
  const { data: internalData, isLoading: loadingInternal } = useQuery({
    queryKey: ['internal-listing', rawId],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', rawId!).single()
      if (error) throw error
      return data
    },
    enabled: !!isInternal && !!rawId,
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = (isMarket && loadingMarket) || (isInternal && loadingInternal)

  const listing = (() => {
    const numId = parseInt(rawId || '0', 10) || 0
    if (isMarket && marketData) return applyPlaceholders(transformListing(marketData, 'market'), numId) as TransformedListing
    if (isInternal && internalData) return applyPlaceholders(transformListing(internalData, 'internal'), numId) as TransformedListing
    return null
  })()

  const { data: marketTemp } = useMarketTemperature(listing?.canton, listing?.city)

  // Reset state when listing changes
  useEffect(() => {
    setPhotoIndex(0)
    setMobilePhotoIndex(0)
    setDescExpanded(false)
    setActiveSection(SECTIONS[0].id)
    setShowDatePicker(false)
    setLightboxOpen(false)
  }, [listingId])

  // Escape key + body scroll lock
  useEffect(() => {
    if (!listingId) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [listingId, onClose, lightboxOpen])

  // Scroll spy
  useEffect(() => {
    if (!listingId || !scrollRef.current) return
    const container = scrollRef.current
    const observers: IntersectionObserver[] = []
    for (const s of SECTIONS) {
      const el = container.querySelector(`#${s.id}`)
      if (!el) continue
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(s.id) },
        { root: container, rootMargin: '-20% 0px -70% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    }
    return () => observers.forEach(o => o.disconnect())
  }, [listingId, listing])

  if (!listingId) return null

  const photos = listing?.photos || []
  const features = listing?.features || []
  const photoCount = photos.length
  const pricePerM2 = listing ? (listing.price_per_m2 > 0 ? listing.price_per_m2 : (listing.surface_m2 > 0 ? Math.round(listing.price / listing.surface_m2) : 0)) : 0

  function scrollToSection(id: string) {
    const el = scrollRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openLightbox(idx: number) {
    setLightboxIndex(idx)
    setLightboxOpen(true)
  }

  // Build characteristics array
  const characteristics: { label: string; value: string }[] = []
  if (listing) {
    if (listing.type) characteristics.push({ label: 'Type', value: TYPE_LABELS[listing.type] || listing.type })
    if (listing.rooms > 0) characteristics.push({ label: 'Pièces', value: String(listing.rooms) })
    if (listing.bedrooms > 0) characteristics.push({ label: 'Chambres', value: String(listing.bedrooms) })
    if (listing.bathrooms > 0) characteristics.push({ label: 'Salles de bain', value: String(listing.bathrooms) })
    if (listing.surface_m2 > 0) characteristics.push({ label: 'Surface habitable', value: formatSurface(listing.surface_m2) })
    if (listing.floor > 0) characteristics.push({ label: 'Étage', value: `${listing.floor}e` })
    if (listing.year_built > 0) characteristics.push({ label: 'Année de construction', value: String(listing.year_built) })
    if (listing.charges_monthly > 0) characteristics.push({ label: 'Charges mensuelles', value: formatCHF(listing.charges_monthly) })
    if (listing.condition) characteristics.push({ label: 'État', value: CONDITION_LABELS[listing.condition] || listing.condition })
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-4 md:pt-[4vh] pb-4 md:pb-[4vh] px-2 md:px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[1100px] max-h-[92vh] bg-white rounded-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Close button — outside photo zone, top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white shadow-md hover:shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 scrollbar-hide">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <div className="h-8 w-8 border-2 border-gray-200 border-t-accent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">Chargement...</p>
            </div>
          ) : listing ? (
            <>
              {/* ════════════════════════════════════════════════════════════
                  PHOTO GALLERY — Desktop: 3-col grid, Mobile: carousel
                  ════════════════════════════════════════════════════════════ */}

              {/* Desktop gallery */}
              <div className="hidden md:block">
                {photoCount > 0 ? (
                  <div className="grid grid-cols-3 gap-1 h-[420px] rounded-t-2xl overflow-hidden">
                    {/* Main photo — 2/3 width */}
                    <div
                      className="col-span-2 h-full relative overflow-hidden cursor-pointer group"
                      onClick={() => openLightbox(photoIndex)}
                    >
                      <img
                        src={photos[photoIndex]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-200"
                      />
                      {/* Navigation on main photo */}
                      {photoIndex > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex(photoIndex - 1) }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Photo précédente"
                        >
                          <ChevronLeft className="h-5 w-5 text-gray-800" />
                        </button>
                      )}
                      {photoIndex < photoCount - 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex(photoIndex + 1) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Photo suivante"
                        >
                          <ChevronRight className="h-5 w-5 text-gray-800" />
                        </button>
                      )}
                    </div>

                    {/* Right column — 2 stacked photos */}
                    <div className="col-span-1 grid grid-rows-2 gap-1 h-full">
                      <div
                        className="overflow-hidden cursor-pointer group"
                        onClick={() => openLightbox(1)}
                      >
                        <img
                          src={photos[1] || photos[0]}
                          alt=""
                          className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-200"
                        />
                      </div>
                      <div
                        className="overflow-hidden cursor-pointer group relative"
                        onClick={() => openLightbox(2)}
                      >
                        <img
                          src={photos[2] || photos[0]}
                          alt=""
                          className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-200"
                        />
                        {/* "Voir les X photos" overlay */}
                        {photoCount > 3 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openLightbox(0) }}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-medium text-sm backdrop-blur-[2px] hover:bg-black/50 transition-colors"
                          >
                            <Images className="w-5 h-5 mr-2" />
                            Voir les {photoCount} photos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] bg-gray-100 flex items-center justify-center rounded-t-2xl">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Aucune photo disponible</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile carousel */}
              <div className="md:hidden relative">
                {photoCount > 0 ? (
                  <>
                    <div
                      ref={mobileCarouselRef}
                      className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-[280px]"
                      onScroll={(e) => {
                        const el = e.currentTarget
                        const idx = Math.round(el.scrollLeft / el.offsetWidth)
                        setMobilePhotoIndex(idx)
                      }}
                    >
                      {photos.map((photo, i) => (
                        <div key={i} className="w-full flex-shrink-0 snap-center">
                          <img
                            src={photo}
                            alt={i === 0 ? listing.title : ''}
                            className="w-full h-full object-cover"
                            onClick={() => openLightbox(i)}
                            loading={i > 2 ? 'lazy' : undefined}
                            decoding="async"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.slice(0, 7).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full transition-all',
                            mobilePhotoIndex === i ? 'bg-gray-900' : 'bg-gray-300'
                          )}
                        />
                      ))}
                      {photoCount > 7 && <div className="w-2 h-2 rounded-full bg-gray-300/60" />}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] bg-gray-100 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-gray-300" />
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════════════════
                  SECTION NAV TABS
                  ════════════════════════════════════════════════════════════ */}
              <SectionNav activeId={activeSection} onNavigate={scrollToSection} />

              {/* ════════════════════════════════════════════════════════════
                  CONTENT: 2 columns (scrollable left + sticky CTA right)
                  ════════════════════════════════════════════════════════════ */}
              <div className="flex flex-col md:flex-row">

                {/* ── LEFT: Details ── */}
                <div className="flex-1 min-w-0 px-6 lg:px-8 py-6">

                  {/* ── SECTION: Overview ── */}
                  <div id="preview-overview">

                    {/* Exclusive badge */}
                    {listing.is_exclusive && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold tracking-wide uppercase mb-3">
                        <Star className="w-3.5 h-3.5 fill-accent" />
                        Exclusif MEGGA
                      </span>
                    )}

                    {/* Price */}
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                      {formatCHF(listing.price)}
                      {pricePerM2 > 0 && (
                        <span className="text-sm text-gray-400 font-normal ml-2">
                          {formatCHF(pricePerM2)}/m²
                        </span>
                      )}
                    </h2>

                    {/* Specs inline with icons */}
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600 text-sm">
                      {listing.rooms > 0 && (
                        <span className="flex items-center gap-1.5">
                          <LayoutGrid className="w-4 h-4 text-gray-400" />
                          {listing.rooms} pièces
                        </span>
                      )}
                      {listing.bedrooms > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="flex items-center gap-1.5">
                            <BedDouble className="w-4 h-4 text-gray-400" />
                            {listing.bedrooms} chambres
                          </span>
                        </>
                      )}
                      {listing.bathrooms > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="flex items-center gap-1.5">
                            <Bath className="w-4 h-4 text-gray-400" />
                            {listing.bathrooms} sdb
                          </span>
                        </>
                      )}
                      {listing.surface_m2 > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="flex items-center gap-1.5">
                            <Maximize2 className="w-4 h-4 text-gray-400" />
                            {formatSurface(listing.surface_m2)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Address */}
                    <p className="flex items-center gap-1.5 mt-2 text-gray-500 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {listing.address}, {listing.postal_code} {listing.city} ({listing.canton})
                    </p>

                    {/* Type + floor badges */}
                    <div className="flex items-center gap-2 mt-3">
                      {listing.type && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          <Home className="w-3.5 h-3.5" />
                          {TYPE_LABELS[listing.type] || listing.type}
                        </span>
                      )}
                      {listing.floor > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {listing.floor}e étage
                        </span>
                      )}
                      {listing.condition && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {CONDITION_LABELS[listing.condition] || listing.condition}
                        </span>
                      )}
                    </div>

                    {/* Engagement stats */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-400">
                      {listing.days_on_market > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {listing.days_on_market}j en ligne
                        </span>
                      )}
                      {listing.charges_monthly > 0 && (
                        <span>Charges : {formatCHF(listing.charges_monthly)}/mois</span>
                      )}
                    </div>

                    {/* Other badges */}
                    {(listing.is_hot || listing.is_new) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {listing.is_hot && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-red-50 text-red-600">Hot price</span>
                        )}
                        {listing.is_new && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-accent">Nouveau</span>
                        )}
                      </div>
                    )}

                    <div className="border-t border-gray-100 my-6" />

                    {/* Description */}
                    {listing.description && (
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Description</h3>
                        <div className={cn(
                          'text-gray-600 text-[15px] leading-relaxed',
                          !descExpanded && 'line-clamp-4'
                        )}>
                          {listing.description.split('\n\n').map((p, i) => (
                            <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>
                          ))}
                        </div>
                        {listing.description.length > 200 && (
                          <button
                            onClick={() => setDescExpanded(!descExpanded)}
                            className="flex items-center gap-1 mt-2 text-accent text-sm font-medium hover:underline"
                          >
                            {descExpanded ? (
                              <>Voir moins <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Voir plus <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Points forts — with icons */}
                    {features.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Points forts</h3>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(features) ? features : Object.keys(features)).map((f, i) => {
                            const label = typeof f === 'string' ? f : String(f)
                            const Icon = getFeatureIcon(label)
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-medium"
                              >
                                <Icon className="w-4 h-4 text-gray-500" />
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Agency */}
                    {listing.agency_name && (
                      <p className="text-xs text-gray-400 mt-5">{listing.agency_name}</p>
                    )}
                  </div>

                  {/* ── SECTION: Details / Caractéristiques ── */}
                  <div id="preview-details" className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Caractéristiques</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      {characteristics.map(({ label, value }, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-500">{label}</span>
                          <span className="text-sm font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── SECTION: Map ── */}
                  <div id="preview-map" className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Localisation</h3>
                    {listing.lat && listing.lng && MAPBOX_TOKEN ? (
                      <div className="h-[250px] rounded-xl overflow-hidden border border-gray-100">
                        <MapGL
                          initialViewState={{ latitude: listing.lat, longitude: listing.lng, zoom: 14 }}
                          mapboxAccessToken={MAPBOX_TOKEN}
                          mapStyle="mapbox://styles/mapbox/light-v11"
                          style={{ width: '100%', height: '100%' }}
                          reuseMaps
                          attributionControl={false}
                          interactive={false}
                        >
                          <NavigationControl position="top-right" showCompass={false} />
                          <Marker latitude={listing.lat} longitude={listing.lng} anchor="bottom">
                            <div className="h-7 w-7 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                              <MapPin className="h-3.5 w-3.5 text-white" />
                            </div>
                          </Marker>
                        </MapGL>
                      </div>
                    ) : (
                      <div className="h-[200px] rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                          <p className="text-sm text-gray-500">{listing.address}, {listing.city}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── SECTION: Quartier ── */}
                  <div id="preview-quartier" className="mt-8 pt-6 border-t border-gray-100">
                    <NeighborhoodSection lat={listing.lat} lng={listing.lng} canton={listing.canton} city={listing.city} compact />
                  </div>

                  {/* ── SECTION: Market ── */}
                  <div id="preview-market" className="mt-8 pt-6 border-t border-gray-100 pb-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Analyse du marché</h3>
                    <div className="space-y-4">
                      {marketTemp && <MarketTemperatureBadge temperature={marketTemp} />}
                      {isMarket && rawId && <PriceHistoryChart marketListingId={rawId} />}
                      <NaturalHazardBadge lat={listing.lat} lng={listing.lng} />
                    </div>
                  </div>

                </div>

                {/* ── RIGHT: Sticky CTA sidebar (desktop) ── */}
                <div className="hidden md:block w-[340px] flex-shrink-0 border-l border-gray-100">
                  <div className="sticky top-[49px] p-6 space-y-4 max-h-[calc(92vh-420px)] overflow-y-auto scrollbar-hide">

                    {showDatePicker ? (
                      <VisitDatePicker onCancel={() => setShowDatePicker(false)} />
                    ) : (
                      <>
                        {/* Primary CTA */}
                        <button
                          onClick={() => setShowDatePicker(true)}
                          className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                          <CalendarDays className="w-5 h-5" />
                          Planifier une visite
                        </button>

                        {/* Secondary CTA */}
                        <button className="w-full h-12 bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors">
                          <Phone className="w-5 h-5" />
                          Contacter l'agent
                        </button>
                      </>
                    )}

                    {/* Tertiary actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsFavorite(!isFavorite)}
                        className={cn(
                          'flex-1 h-10 bg-white border text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors',
                          isFavorite
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        )}
                      >
                        <Heart className={cn('w-4 h-4', isFavorite && 'fill-current')} />
                        {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
                      </button>
                      <button className="flex-1 h-10 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                        <Share2 className="w-4 h-4" />
                        Partager
                      </button>
                    </div>

                    <div className="border-t border-gray-100 my-2" />

                    {/* Agency info */}
                    {listing.agency_name && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {listing.agency_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{listing.agency_name}</p>
                          <p className="text-xs text-gray-500">{listing.city || listing.canton}</p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-100 my-2" />

                    {/* Full page link */}
                    <Link
                      to={`/listing/${listingId}`}
                      className="block text-center text-sm font-medium text-accent hover:underline"
                    >
                      Voir la fiche complète →
                    </Link>
                  </div>
                </div>
              </div>

              {/* ── Mobile CTA bar ── */}
              <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3 z-40">
                <button className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors">
                  <CalendarDays className="h-4 w-4" />
                  Visite
                </button>
                <button className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 transition-colors">
                  <Phone className="h-4 w-4" />
                  Appeler
                </button>
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    'h-11 w-11 rounded-xl border flex items-center justify-center transition-colors',
                    isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500'
                  )}
                >
                  <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px]">
              <p className="text-sm text-gray-500">Bien non trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {listing && (
        <Lightbox
          photos={photos}
          open={lightboxOpen}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>,
    document.body
  )
}
