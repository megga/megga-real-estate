import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin, DoorOpen, BedDouble, Bath, Maximize, Building2, Heart, Share2,
  Phone, Mail, CalendarDays, ChevronLeft, ChevronRight, X, Images, Calculator,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import AffordabilityCalculator from '@/components/listings/AffordabilityCalculator'
import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import MarketTemperatureBadge from '@/components/listings/MarketTemperatureBadge'
import NaturalHazardBadge from '@/components/listings/NaturalHazardBadge'
import RequestVisitModal from '@/components/listings/RequestVisitModal'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useMarketListings, useMarketListing } from '@/hooks/useMarketListings'
import { useMarketTemperature } from '@/hooks/useMarketInsights'
import { getListingById } from '@/lib/mockData'

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'hot' | 'new' | 'exclusive' | 'default' }) {
  const styles = {
    hot: 'bg-danger text-white',
    new: 'bg-accent text-white',
    exclusive: 'bg-primary-900 text-white',
    default: 'bg-section text-primary-700',
  }
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-badge inline-flex items-center gap-1', styles[variant])}>
      {children}
    </span>
  )
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const rawId = id?.replace('market-', '').replace('internal-', '')
  const isMarketListing = id?.startsWith('market-')
  const isInternalListing = id?.startsWith('internal-')

  // Fetch from Supabase for market listings
  const { data: marketData, isLoading: isLoadingMarket } = useMarketListing(isMarketListing ? rawId : undefined)

  // Fetch from Supabase for internal listings (properties table)
  const { data: internalData, isLoading: isLoadingInternal } = useQuery({
    queryKey: ['internal-listing', rawId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', rawId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!isInternalListing && !!rawId,
    staleTime: 10 * 60 * 1000,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function transformSupabaseToListing(data: Record<string, any>, source: 'market' | 'internal') {
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
      floor: Number(data.floor) || 0,
      total_floors: 0,
      photos: (data.photos as string[]) || [],
      description: (data.description as string) || '',
      features: (data.features as string[]) || [],
      type: (data.type as string) || 'apartment',
      price_per_m2: source === 'market' ? Number(data.price_per_m2) || 0 : 0,
      days_on_market: source === 'market' ? Number(data.days_on_market) || 0 : 0,
      charges_monthly: Number(data.charges_monthly) || 0,
      is_hot: source === 'market' ? data.status === 'price_reduced' : false,
      is_new: source === 'market' ? Number(data.days_on_market) <= 3 : false,
      is_exclusive: source === 'internal',
      lat: data.lat as number | undefined,
      lng: data.lng as number | undefined,
      agency_name: source === 'market' ? ((data.agency_name as string) || '') : 'MEGGA Real Estate',
      agent: {
        name: source === 'market' ? ((data.agency_name as string) || 'Agent') : 'Agent MEGGA',
        agency: 'MEGGA Real Estate',
        phone: '+41 22 000 00 00',
        email: 'contact@megga.ch',
        photo: '/megga-gg.svg',
      },
    }
  }

  // Transform Supabase data to listing format, fallback to mockData
  const isLoadingData = (isMarketListing && isLoadingMarket) || (isInternalListing && isLoadingInternal)
  const listing = (() => {
    if (isMarketListing && marketData) return transformSupabaseToListing(marketData, 'market')
    if (isInternalListing && internalData) return transformSupabaseToListing(internalData, 'internal')
    return getListingById(id || '')
  })()

  const [isFavorite, setIsFavorite] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showVisitModal, setShowVisitModal] = useState(false)

  // Market insights
  const { data: marketTemp } = useMarketTemperature(listing?.canton, listing?.city)

  // Similar listings: same canton + same type + price ±30%
  const similarFilters = listing ? {
    context: 'buy' as const,
    canton: listing.canton,
    types: [listing.type],
    minPrice: Math.round(listing.price * 0.7),
    maxPrice: Math.round(listing.price * 1.3),
  } : {}
  const { data: similarData } = useMarketListings(listing ? similarFilters : {})
  const similarListings = (similarData?.pages.flatMap(p => p.listings) ?? [])
    .filter(l => l.id !== `market-${id}` && l.id !== `internal-${id}`)
    .slice(0, 6)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="h-8 w-8 border-2 border-gray-200 border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">Chargement du bien...</p>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-primary-900 mb-2">Bien non trouve</p>
          <p className="text-sm text-muted-foreground mb-6">Ce bien n'existe pas ou a ete retire.</p>
          <Link to="/search">
            <Button>Retour a la recherche</Button>
          </Link>
        </div>
      </div>
    )
  }

  const photos = listing.photos

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  function scrollCarousel(dir: 'left' | 'right') {
    if (!carouselRef.current) return
    const w = carouselRef.current.offsetWidth
    carouselRef.current.scrollBy({ left: dir === 'right' ? w : -w, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* === PHOTO GALLERY — Desktop: Airbnb grid === */}
      <section className="hidden md:block max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-card overflow-hidden relative">
          {/* Main photo */}
          <button
            className="col-span-2 row-span-2 relative overflow-hidden"
            onClick={() => openLightbox(0)}
          >
            <img src={photos[0]} alt={listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </button>
          {/* Secondary photos */}
          {photos.slice(1, 5).map((photo, i) => (
            <button
              key={i}
              className="relative overflow-hidden"
              onClick={() => openLightbox(i + 1)}
            >
              <img src={photo} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              {/* "See all" overlay on last visible photo */}
              {i === 3 && photos.length > 5 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-medium flex items-center gap-1.5">
                    <Images className="h-4 w-4" />
                    +{photos.length - 5} photos
                  </span>
                </div>
              )}
            </button>
          ))}
          {/* See all photos button */}
          <button
            onClick={() => openLightbox(0)}
            className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-primary-900 text-sm font-medium px-4 py-2 rounded-button shadow-card hover:bg-white transition-colors flex items-center gap-2"
          >
            <Images className="h-4 w-4" />
            Voir les {photos.length} photos
          </button>
        </div>
      </section>

      {/* === PHOTO GALLERY — Mobile: Horizontal carousel === */}
      <section className="md:hidden relative">
        <div
          ref={carouselRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
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
                className="w-full h-64 object-cover"
                onClick={() => openLightbox(i)}
              />
            </div>
          ))}
        </div>
        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <div key={i} className={cn('h-1.5 rounded-full transition-all', mobilePhotoIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60')} />
          ))}
        </div>
        {/* Nav arrows */}
        {photos.length > 1 && (
          <>
            <button onClick={() => scrollCarousel('left')} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => scrollCarousel('right')} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        {/* Counter */}
        <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
          {mobilePhotoIndex + 1}/{photos.length}
        </div>
      </section>

      {/* === MAIN CONTENT === */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* LEFT COLUMN — Details */}
          <div className="flex-1 min-w-0">
            {/* Title + badges */}
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {listing.is_hot && <Badge variant="hot">🔥 Hot price</Badge>}
                {listing.is_new && <Badge variant="new">Nouveau</Badge>}
                {listing.is_exclusive && <Badge variant="exclusive">Exclusif</Badge>}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-primary-900 mb-2">
                {listing.title}
              </h1>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {listing.address}, {listing.postal_code} {listing.city} ({listing.canton})
                </span>
              </div>
            </div>

            {/* Key stats */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6 py-5 border-y border-border mb-6">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary-900">{listing.rooms}</p>
                  <p className="text-xs text-muted-foreground">Pièces</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary-900">{listing.bedrooms}</p>
                  <p className="text-xs text-muted-foreground">Chambres</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bath className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary-900">{listing.bathrooms}</p>
                  <p className="text-xs text-muted-foreground">Salle{listing.bathrooms > 1 ? 's' : ''} de bain</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Maximize className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary-900">{formatSurface(listing.surface_m2)}</p>
                  <p className="text-xs text-muted-foreground">Surface</p>
                </div>
              </div>
              {listing.floor !== null && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm font-semibold text-primary-900">{listing.floor}e/{listing.total_floors}</p>
                    <p className="text-xs text-muted-foreground">Étage</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">Description</h2>
              <div className="text-sm text-primary-700 leading-relaxed space-y-4">
                {listing.description.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Features grid */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">Caractéristiques</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {Object.entries(listing.features).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2.5 border-b border-border-light">
                    <span className="text-sm text-muted-foreground">{key}</span>
                    <span className="text-sm font-medium text-primary-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map placeholder */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">Localisation</h2>
              <div className="bg-section rounded-card h-64 flex items-center justify-center border border-border">
                <div className="text-center">
                  <MapPin className="h-8 w-8 text-accent mx-auto mb-2" />
                  <p className="text-sm font-medium text-primary-700">{listing.address}</p>
                  <p className="text-xs text-muted-foreground">{listing.postal_code} {listing.city}</p>
                  <p className="text-xs text-muted-foreground mt-2">Carte Mapbox — bientôt disponible</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR — Sticky */}
          <div className="hidden lg:block w-[380px] flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              {/* Price card */}
              <div className="bg-white rounded-card border border-border p-6 shadow-card">
                <p className="text-3xl font-bold text-primary-900 mb-1">
                  {formatCHF(listing.price)}
                </p>
                {listing.charges_monthly > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Charges : {formatCHF(listing.charges_monthly)}/mois
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={cn(
                      'flex-1 h-10 rounded-button border flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                      isFavorite
                        ? 'bg-danger-light border-danger text-danger'
                        : 'border-border text-primary-700 hover:bg-section'
                    )}
                  >
                    <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                    {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
                  </button>
                  <button className="h-10 w-10 rounded-button border border-border flex items-center justify-center text-primary-700 hover:bg-section transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowCalculator(true)}
                  className="w-full h-10 mt-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
                >
                  <Calculator className="h-4 w-4" />
                  Puis-je acheter ce bien ?
                </button>
              </div>

              {/* Price history chart */}
              {isMarketListing && rawId && (
                <PriceHistoryChart marketListingId={rawId} />
              )}

              {/* Market temperature */}
              {marketTemp && (
                <MarketTemperatureBadge temperature={marketTemp} />
              )}

              {/* Natural hazards */}
              <NaturalHazardBadge lat={listing.lat} lng={listing.lng} />

              {/* Agent card */}
              <div className="bg-white rounded-card border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={listing.agent.photo}
                    alt={listing.agent.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-primary-900">{listing.agent.name}</p>
                    <p className="text-xs text-muted-foreground">{listing.agent.agency}</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <a href={`tel:${listing.agent.phone}`} className="flex items-center gap-2 text-sm text-primary-700 hover:text-accent transition-colors">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {listing.agent.phone}
                  </a>
                  <a href={`mailto:${listing.agent.email}`} className="flex items-center gap-2 text-sm text-primary-700 hover:text-accent transition-colors">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {listing.agent.email}
                  </a>
                </div>
                <div className="space-y-2">
                  <Button className="w-full h-11 rounded-button gap-2">
                    <Mail className="h-4 w-4" />
                    Contacter l'agent
                  </Button>
                  <button
                    onClick={() => setShowVisitModal(true)}
                    className="w-full h-11 flex items-center justify-center gap-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:border-accent hover:text-accent transition-colors cursor-pointer"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Planifier une visite
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE STICKY PRICE BAR === */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-primary-900">{formatCHF(listing.price)}</p>
            {listing.charges_monthly > 0 && (
              <p className="text-xs text-muted-foreground">Charges : {formatCHF(listing.charges_monthly)}/mois</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={cn(
                'h-10 w-10 rounded-full border flex items-center justify-center transition-colors',
                isFavorite ? 'bg-danger-light border-danger text-danger' : 'border-border text-primary-600'
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
            <Button size="default" className="rounded-full gap-2">
              <Phone className="h-4 w-4" />
              Contacter
            </Button>
          </div>
        </div>
      </div>

      {/* === LIGHTBOX === */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm">{lightboxIndex + 1} / {photos.length}</span>
            <button onClick={() => setLightboxOpen(false)} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4 relative">
            <img
              src={photos[lightboxIndex]}
              alt=""
              className="max-h-full max-w-full object-contain rounded-lg"
            />
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            )}
          </div>
          {/* Thumbnails */}
          <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto">
            {photos.map((photo, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className={cn(
                  'h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
                  lightboxIndex === i ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-75'
                )}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === SIMILAR LISTINGS === */}
      {similarListings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 mb-20 lg:mb-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Biens similaires</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {similarListings.map((sl) => {
              const photo = sl.photos?.[0]
              return (
                <Link
                  key={sl.id}
                  to={`/listing/${sl.id}`}
                  className="block bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    {photo ? (
                      <img src={photo} alt={sl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-semibold text-gray-900">
                      <span className="text-sm font-normal text-gray-500">CHF </span>
                      {formatCHF(sl.price).replace('CHF ', '')}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{sl.address}, {sl.city}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1.5">
                      {sl.rooms > 0 && <span>{sl.rooms} pièces</span>}
                      {sl.rooms > 0 && sl.surface_m2 > 0 && <span className="text-gray-300">·</span>}
                      {sl.surface_m2 > 0 && <span>{formatSurface(sl.surface_m2)}</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Affordability calculator */}
      {listing && (
        <AffordabilityCalculator
          price={listing.price}
          open={showCalculator}
          onClose={() => setShowCalculator(false)}
        />
      )}

      {/* Request visit modal */}
      {listing && (
        <RequestVisitModal
          listingAddress={`${listing.address}, ${listing.city}`}
          open={showVisitModal}
          onClose={() => setShowVisitModal(false)}
        />
      )}
    </div>
  )
}
