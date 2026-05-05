import { useState, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useMarketListings, useMarketListing } from '@/hooks/useMarketListings'
import { getListingById } from '@/lib/mockData'
import { generateListingTitle, type Lang } from '@/lib/listingTitle'
import { Button } from '@/components/ui/button'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import AffordabilityCalculator from '@/components/listings/AffordabilityCalculator'
import RequestVisitModal from '@/components/listings/RequestVisitModal'

// New listing components
import ListingHeroGallery from '@/components/listing/ListingHeroGallery'
import ListingStickyNav, { type SectionDef } from '@/components/listing/ListingStickyNav'
import ListingHeader from '@/components/listing/ListingHeader'
import BienBreadcrumb from '@/components/listing/BienBreadcrumb'
import BienTitleBar from '@/components/listing/BienTitleBar'
import ListingDescription from '@/components/listing/ListingDescription'
import ListingFeatures from '@/components/listing/ListingFeatures'
import ListingMap from '@/components/listing/ListingMap'
import ListingMarketSection from '@/components/listing/ListingMarketSection'
import ListingSimilarCarousel from '@/components/listing/ListingSimilarCarousel'
import BienAgentCard from '@/components/listing/BienAgentCard'
import C2PaBadge from '@/components/listing/C2PaBadge'
import ListingLightbox from '@/components/listing/ListingLightbox'
import ListingMobileBar from '@/components/listing/ListingMobileBar'
import NeighborhoodSection from '@/components/listing/NeighborhoodSection'
import InteractiveFloorPlan from '@/components/listing/InteractiveFloorPlan'
import ContactAgentModal from '@/components/listing/ContactAgentModal'
import type { FloorPlanHotspot } from '@/types/floorPlan'

// ─── Section definitions for sticky nav ─────────────────────────────────

const BASE_SECTIONS: SectionDef[] = [
  { id: 'description', label: 'Description' },
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'localisation', label: 'Localisation' },
  { id: 'quartier', label: 'Quartier' },
  { id: 'marche', label: 'Marché' },
  { id: 'similaires', label: 'Similaires' },
]

// ─── Transform raw Supabase data to listing format ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformSupabaseToListing(data: Record<string, any>, source: 'market' | 'internal', lang: Lang = 'fr') {
  const localizedTitle = generateListingTitle(
    {
      type: data.type as string | null,
      rooms: Number(data.rooms) || 0,
      city: data.city as string | null,
      transaction_type: data.transaction_type as string | null,
      title: data.title as string | null,
    },
    lang,
  )
  return {
    id: data.id,
    title: localizedTitle || data.title || 'Bien immobilier',
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
    floor_plan_url: (data.floor_plan_url as string) || null,
    floor_plan_hotspots: (data.floor_plan_hotspots as FloorPlanHotspot[]) || [],
    transaction_type: ((data.transaction_type as string) || 'buy') as 'buy' | 'rent',
    is_furnished: !!data.is_furnished,
    deposit_months: (data.deposit_months as number | null | undefined) ?? null,
    external_regie: (data.external_regie as { name?: string; phone?: string; email?: string; website?: string } | null) ?? null,
  }
}

// ─── Page Component ─────────────────────────────────────────────────────

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const { i18n } = useTranslation()
  const short = i18n.language.slice(0, 2).toLowerCase()
  const normalizedLang: Lang = short === 'de' || short === 'en' || short === 'it' ? short : 'fr'
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
    if (isMarketListing && marketData) return transformSupabaseToListing(marketData, 'market', normalizedLang)
    if (isInternalListing && internalData) return transformSupabaseToListing(internalData, 'internal', normalizedLang)
    return getListingById(id || '')
  }, [isMarketListing, isInternalListing, marketData, internalData, id, normalizedLang])

  // ── Agent profile (internal listings only) ──
  const { data: agentProfile } = useQuery({
    queryKey: ['agent-profile', internalData?.created_by],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, email')
        .eq('id', internalData!.created_by)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!isInternalListing && !!internalData?.created_by,
    staleTime: 30 * 60 * 1000,
  })

  // ── Resolved agent (real profile for internal, agency name for market) ──
  const resolvedAgent = useMemo(() => {
    if (isInternalListing && agentProfile) {
      return {
        name: agentProfile.full_name || 'Agent MEGGA',
        agency: 'MEGGA Real Estate',
        phone: agentProfile.phone || '',
        email: agentProfile.email || 'contact@megga.ch',
        photo: agentProfile.avatar_url || '',
      }
    }
    if (isMarketListing && marketData?.agency_name) {
      return {
        name: marketData.agency_name as string,
        agency: marketData.agency_name as string,
        phone: '',
        email: 'contact@megga.ch',
        photo: '',
      }
    }
    return listing?.agent ?? {
      name: 'Agent MEGGA',
      agency: 'MEGGA Real Estate',
      phone: '+41 22 000 00 00',
      email: 'contact@megga.ch',
      photo: '',
    }
  }, [isInternalListing, isMarketListing, agentProfile, marketData, listing])

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
  const [searchParams] = useSearchParams()
  const photoParam = searchParams.get('photo')
  const initialPhotoIdx = photoParam ? parseInt(photoParam, 10) : -1
  const [isFavorite, setIsFavorite] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(initialPhotoIdx >= 0)
  const [lightboxIndex, setLightboxIndex] = useState(initialPhotoIdx >= 0 ? initialPhotoIdx : 0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [floorPlanRoom, setFloorPlanRoom] = useState<string | null>(null)

  // Floor plan data (safely access — mock listings won't have these)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listingAny = listing as Record<string, any> | null
  const floorPlanUrl = listingAny?.floor_plan_url as string | null ?? null
  const floorPlanHotspots = (listingAny?.floor_plan_hotspots as FloorPlanHotspot[]) ?? []

  // Dynamic sections (add Plan tab if floor plan exists)
  const SECTIONS: SectionDef[] = floorPlanUrl
    ? [BASE_SECTIONS[0], BASE_SECTIONS[1], { id: 'plan', label: 'Plan' }, ...BASE_SECTIONS.slice(2)]
    : BASE_SECTIONS

  // ── Loading state ──
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-white">
        <HomeStickyHeader alwaysShow />
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
        <HomeStickyHeader alwaysShow />
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

  // Mode pour Breadcrumb + TitleBar : 'louer' si rent, 'acheter' sinon
  // (cast nécessaire — MockListing n'a pas transaction_type, market sí)
  const txType = (listing as { transaction_type?: string }).transaction_type
  const mode: 'louer' | 'acheter' = txType === 'rent' ? 'louer' : 'acheter'
  const isPriceReduced =
    !!(listing as { price_reduced?: boolean }).price_reduced || !!listing.is_hot
  const constructionYear = (listing as { construction_year?: number | null })
    .construction_year
  const isNew = !!constructionYear && constructionYear >= 2020

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
        background: '#FAFBFD',
      }}
    >
      <HomeStickyHeader alwaysShow />

      {/* ── Breadcrumb (proto megga-bien-page.jsx) ── */}
      <BienBreadcrumb
        mode={mode}
        canton={listing.canton}
        address={listing.address}
        type={listing.type}
        rooms={listing.rooms}
      />

      {/* ── Hero Gallery (max-width 1280) ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px clamp(20px, 4vw, 32px) 0' }}>
        <ListingHeroGallery
          photos={listing.photos}
          title={listing.title}
          onOpenLightbox={openLightbox}
          activeRoom={floorPlanRoom}
          photoTags={(listingAny?.photo_tags as import('@/types/floorPlan').PhotoTag[]) ?? []}
        />
      </div>

      {/* ── Title bar (chips + h1 + address + actions, port proto) ── */}
      <BienTitleBar
        title={listing.title}
        type={listing.type}
        mode={mode}
        isNew={isNew}
        isPriceReduced={isPriceReduced}
        address={`${listing.address}, ${listing.postal_code} ${listing.city}`}
        canton={listing.canton}
        isFavorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
      />

      {/* ── Sticky Section Navigation ── */}
      <ListingStickyNav sections={SECTIONS} />

      {/* ── Main Content + Sidebar ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex gap-10">
          {/* Left: Content */}
          <div className="flex-1 min-w-0">
            <ListingHeader listing={listing} />
            {(listing as { c2pa_verified?: boolean; c2pa_verified_at?: string }).c2pa_verified && (
              <div className="mb-4">
                <C2PaBadge
                  verified={(listing as { c2pa_verified?: boolean }).c2pa_verified || false}
                  verifiedAt={(listing as { c2pa_verified_at?: string }).c2pa_verified_at}
                />
              </div>
            )}
            <ListingDescription description={listing.description} />
            <ListingFeatures features={listing.features} />

            {/* Floor Plan Interactif */}
            {floorPlanUrl && floorPlanHotspots.length > 0 && (
              <div id="plan" className="scroll-mt-28 mt-10 pt-8 border-t border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan interactif</h2>
                <InteractiveFloorPlan
                  floorPlanUrl={floorPlanUrl}
                  hotspots={floorPlanHotspots}
                  activeRoom={floorPlanRoom}
                  onRoomClick={(roomKey, photoUrls) => {
                    if (!roomKey || roomKey === floorPlanRoom) {
                      setFloorPlanRoom(null)
                    } else {
                      setFloorPlanRoom(roomKey)
                      if (photoUrls.length > 0) {
                        setLightboxIndex(0)
                        setLightboxOpen(true)
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: BienAgentCard (port proto megga-bien-contact.jsx sticky) */}
          <div style={{ width: 380, flexShrink: 0, display: 'block' }} className="hidden lg:block">
            <BienAgentCard
              agent={{
                name: resolvedAgent.name,
                agency: resolvedAgent.agency,
                phone: resolvedAgent.phone,
                email: resolvedAgent.email,
                photo: resolvedAgent.photo || null,
              }}
              bienId={listing.id}
              status={(listing as { status?: string }).status as 'available' | 'compromis' | 'sold' | undefined}
              isFavorite={isFavorite}
              onToggleFavorite={() => setIsFavorite(!isFavorite)}
              onAskVisit={() => setShowVisitModal(true)}
              onContact={() => setShowContactModal(true)}
            />
          </div>
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
        onClose={() => { setLightboxOpen(false); setFloorPlanRoom(null) }}
        onIndexChange={setLightboxIndex}
        photoTags={(listingAny?.photo_tags as import('@/types/floorPlan').PhotoTag[]) ?? []}
        floorPlanUrl={floorPlanUrl || undefined}
        floorPlanHotspots={floorPlanHotspots}
        stagedPhotos={(listingAny?.staged_photos as string[]) ?? undefined}
        listingId={id}
      />
      <ContactAgentModal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        agent={resolvedAgent}
        listingTitle={listing.title}
        listingAddress={`${listing.address}, ${listing.city}`}
      />
      <AffordabilityCalculator
        price={listing.price}
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
      <RequestVisitModal
        listingAddress={`${listing.address}, ${listing.city}`}
        propertyId={rawId || ''}
        agencyId={listingAny?.agency_id as string || ''}
        listingPhoto={listing.photos?.[0]}
        listingPrice={listing.price ? `CHF ${listing.price.toLocaleString('fr-CH').replace(/\s/g, "'")}` : undefined}
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
