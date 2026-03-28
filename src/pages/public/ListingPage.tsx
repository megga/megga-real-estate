import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useMarketListings, useMarketListing } from '@/hooks/useMarketListings'
import { getListingById } from '@/lib/mockData'
import { applyPlaceholders } from '@/lib/placeholderData'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import AffordabilityCalculator from '@/components/listings/AffordabilityCalculator'
import RequestVisitModal from '@/components/listings/RequestVisitModal'

// New listing components
import ListingHeroGallery from '@/components/listing/ListingHeroGallery'
import ListingStickyNav, { type SectionDef } from '@/components/listing/ListingStickyNav'
import ListingHeader from '@/components/listing/ListingHeader'
import ListingDescription from '@/components/listing/ListingDescription'
import ListingFeatures from '@/components/listing/ListingFeatures'
import ListingMap from '@/components/listing/ListingMap'
import ListingMarketSection from '@/components/listing/ListingMarketSection'
import ListingSimilarCarousel from '@/components/listing/ListingSimilarCarousel'
import ListingSidebar from '@/components/listing/ListingSidebar'
import ListingLightbox from '@/components/listing/ListingLightbox'
import ListingMobileBar from '@/components/listing/ListingMobileBar'
import NeighborhoodSection from '@/components/listing/NeighborhoodSection'

// ─── Section definitions for sticky nav ─────────────────────────────────

const SECTIONS: SectionDef[] = [
  { id: 'description', label: 'Description' },
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'localisation', label: 'Localisation' },
  { id: 'quartier', label: 'Quartier' },
  { id: 'marche', label: 'Marché' },
  { id: 'similaires', label: 'Similaires' },
]

// ─── Transform raw Supabase data to listing format ──────────────────────

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

// ─── Page Component ─────────────────────────────────────────────────────

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const rawId = id?.replace('market-', '').replace('internal-', '')
  const isMarketListing = id?.startsWith('market-')
  const isInternalListing = id?.startsWith('internal-')

  // ── Data fetching ──
  const { data: marketData, isLoading: isLoadingMarket } = useMarketListing(isMarketListing ? rawId : undefined)
  const { data: internalData, isLoading: isLoadingInternal } = useQuery({
    queryKey: ['internal-listing', rawId],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', rawId!).single()
      if (error) throw error
      return data
    },
    enabled: !!isInternalListing && !!rawId,
    staleTime: 10 * 60 * 1000,
  })

  // ── Transform ──
  const isLoadingData = (isMarketListing && isLoadingMarket) || (isInternalListing && isLoadingInternal)
  const listing = useMemo(() => {
    const numId = parseInt(rawId || '0', 10) || 0
    if (isMarketListing && marketData) return applyPlaceholders(transformSupabaseToListing(marketData, 'market'), numId)
    if (isInternalListing && internalData) return applyPlaceholders(transformSupabaseToListing(internalData, 'internal'), numId)
    return getListingById(id || '')
  }, [isMarketListing, isInternalListing, marketData, internalData, rawId, id])

  // ── Similar listings ──
  const similarFilters = useMemo(() => listing ? {
    context: 'buy' as const,
    canton: listing.canton,
    types: [listing.type],
    minPrice: Math.round(listing.price * 0.7),
    maxPrice: Math.round(listing.price * 1.3),
  } : {}, [listing])
  const { data: similarData } = useMarketListings(listing ? similarFilters : {})
  const similarListings = useMemo(
    () => (similarData?.pages.flatMap(p => p.listings) ?? [])
      .filter(l => l.id !== id)
      .slice(0, 8),
    [similarData, id]
  )

  // ── State ──
  const [isFavorite, setIsFavorite] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showVisitModal, setShowVisitModal] = useState(false)

  // ── Loading state ──
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

  // ── Not found state ──
  if (!listing) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-gray-900 mb-2">Bien non trouvé</p>
          <p className="text-sm text-gray-500 mb-6">Ce bien n'existe pas ou a été retiré.</p>
          <Link to="/acheter"><Button>Retour à la recherche</Button></Link>
        </div>
      </div>
    )
  }

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero Gallery ── */}
      <ListingHeroGallery
        photos={listing.photos}
        title={listing.title}
        onOpenLightbox={openLightbox}
      />

      {/* ── Sticky Section Navigation ── */}
      <ListingStickyNav sections={SECTIONS} />

      {/* ── Main Content + Sidebar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex gap-10">
          {/* Left: Content */}
          <div className="flex-1 min-w-0">
            <ListingHeader listing={listing} />
            <ListingDescription description={listing.description} />
            <ListingFeatures features={listing.features} />
          </div>

          {/* Right: Sidebar (desktop) */}
          <ListingSidebar
            listing={listing}
            isFavorite={isFavorite}
            onToggleFavorite={() => setIsFavorite(!isFavorite)}
            onContact={() => {}}
            onVisit={() => setShowVisitModal(true)}
            onCalculator={() => setShowCalculator(true)}
          />
        </div>
      </div>

      {/* ── Map (full-bleed) ── */}
      <ListingMap
        lat={listing.lat}
        lng={listing.lng}
        address={listing.address}
        city={listing.city}
        postal_code={listing.postal_code}
      />

      {/* ── Neighborhood Insights ── */}
      <div id="quartier" className="scroll-mt-28 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <NeighborhoodSection lat={listing.lat} lng={listing.lng} canton={listing.canton} city={listing.city} />
      </div>

      {/* ── Market Analysis ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <ListingMarketSection
          isMarket={!!isMarketListing}
          rawId={rawId}
          canton={listing.canton}
          city={listing.city}
          lat={listing.lat}
          lng={listing.lng}
        />
      </div>

      {/* ── Similar Listings Carousel (full-bleed) ── */}
      <ListingSimilarCarousel listings={similarListings} />

      {/* ── Overlays ── */}
      <ListingLightbox
        photos={listing.photos}
        open={lightboxOpen}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
      <AffordabilityCalculator
        price={listing.price}
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
      <RequestVisitModal
        listingAddress={`${listing.address}, ${listing.city}`}
        open={showVisitModal}
        onClose={() => setShowVisitModal(false)}
      />

      {/* ── Mobile Sticky Bar ── */}
      <ListingMobileBar
        price={listing.price}
        charges_monthly={listing.charges_monthly}
        isFavorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
        onContact={() => {}}
      />
    </div>
  )
}
