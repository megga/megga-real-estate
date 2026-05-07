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
import FooterMega from '@/components/layout/FooterMega'
import AffordabilityCalculator from '@/components/listings/AffordabilityCalculator'
import RequestVisitModal from '@/components/listings/RequestVisitModal'

// New listing components (port proto MEGGA Bien.html)
import ListingHeroGallery from '@/components/listing/ListingHeroGallery'
import BienBreadcrumb from '@/components/listing/BienBreadcrumb'
import BienTitleBar from '@/components/listing/BienTitleBar'
import BienPriceCard from '@/components/listing/BienPriceCard'
import ListingDescription from '@/components/listing/ListingDescription'
import BienSpecsBlock from '@/components/listing/BienSpecsBlock'
import BienEnergyBlock from '@/components/listing/BienEnergyBlock'
import BienNeighborhoodBlock from '@/components/listing/BienNeighborhoodBlock'
import BienDocumentsBlock from '@/components/listing/BienDocumentsBlock'
import BienSimilarBlock from '@/components/listing/BienSimilarBlock'
import BienAgentCard from '@/components/listing/BienAgentCard'
import C2PaBadge from '@/components/listing/C2PaBadge'
import ListingLightbox from '@/components/listing/ListingLightbox'
import ListingMobileBar from '@/components/listing/ListingMobileBar'
import InteractiveFloorPlan from '@/components/listing/InteractiveFloorPlan'
import ContactAgentModal from '@/components/listing/ContactAgentModal'
import type { FloorPlanHotspot } from '@/types/floorPlan'

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
    source_portal: source === 'market' ? ((data.source_portal as string) || null) : null,
    source_url: source === 'market' ? ((data.source_url as string) || null) : null,
    gallery_layout: source === 'internal' ? ((data.gallery_layout as 'hero' | 'mosaic' | 'carousel' | null | undefined) ?? 'hero') : 'hero',
    // Amenity flags (proto SpecsBlock + équipements pills)
    year_built: (data.year_built as number | null | undefined) ?? null,
    energy_label: (data.energy_label as string | null | undefined) ?? null,
    has_balcony: !!data.has_balcony,
    has_swimming_pool: !!data.has_swimming_pool,
    has_nice_view: !!data.has_nice_view,
    has_garage: !!data.has_garage,
    has_parking: !!data.has_parking,
    has_elevator: !!data.has_elevator,
    has_fireplace: !!data.has_fireplace,
    is_new_building: !!data.is_new_building,
    is_minergie: !!data.is_minergie,
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

  // ── Resolved agent — proto-faithful (port megga-bien-contact.jsx).
  // Le proto utilise une variante "partenaire" (Naef/Cardis/Bernard Nicod)
  // avec un agent humain (ex: Sophie Martin) en façade. Pour les annonces
  // marketplace on hardcode Naef + Sophie Martin pour matcher la maquette.
  const resolvedAgent = useMemo(() => {
    // Internal listing with real agent profile
    if (isInternalListing && agentProfile) {
      return {
        name: agentProfile.full_name || 'Sophie Martin',
        agency: 'MEGGA Real Estate · Genève',
        phone: agentProfile.phone || '+41 22 555 04 21',
        email: agentProfile.email || '',
        photo: agentProfile.avatar_url || '',
      }
    }
    // Market listing → agent humain "Sophie Martin" + partenaire Naef (proto)
    if (isMarketListing) {
      return {
        name: 'Sophie Martin',
        agency: 'Naef Immobilier',
        phone: '+41 22 555 04 21',
        email: 'sophie.martin@naef.ch',
        photo: '',
      }
    }
    // Mock/fallback listing
    return listing?.agent ?? {
      name: 'Sophie Martin',
      agency: 'MEGGA Real Estate',
      phone: '+41 22 555 04 21',
      email: '',
      photo: '',
    }
  }, [isInternalListing, isMarketListing, agentProfile, listing])

  // ── Similar listings ──
  const similarTxType = (listing as { transaction_type?: string } | null)?.transaction_type
  const similarFilters = useMemo(() => listing ? {
    context: similarTxType === 'rent' ? ('rent' as const) : ('buy' as const),
    canton: listing.canton,
    types: [listing.type],
  } : {}, [listing, similarTxType])
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
  const yearBuilt =
    (listing as { year_built?: number | null }).year_built ??
    (listing as { construction_year?: number | null }).construction_year ??
    null
  const isNew = !!yearBuilt && yearBuilt >= 2020

  // Build équipements list from booleans + raw features array (proto-fidèle pills)
  const equipmentsList: string[] = (() => {
    const out: string[] = []
    const l = listing as Record<string, unknown>
    if (l.has_balcony) out.push('Balcon')
    if (l.has_garage) out.push('Garage')
    if (l.has_parking && !l.has_garage) out.push('Parking')
    if (l.has_elevator) out.push('Ascenseur')
    if (l.has_nice_view) out.push('Vue dégagée')
    if (l.has_swimming_pool) out.push('Piscine')
    if (l.has_fireplace) out.push('Cheminée')
    if (l.is_minergie) out.push('Minergie')
    if (l.is_new_building) out.push('Construction récente')
    if (l.is_furnished) out.push('Meublé')
    if (Array.isArray(l.features)) {
      for (const f of l.features as unknown[]) {
        if (typeof f === 'string' && !out.includes(f)) out.push(f)
      }
    }
    return out
  })()

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

      {/* ── Hero Gallery (max-width 1280) — variant choisie par l'agent ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px clamp(20px, 4vw, 32px) 0' }}>
        <ListingHeroGallery
          photos={listing.photos}
          title={listing.title}
          onOpenLightbox={openLightbox}
          activeRoom={floorPlanRoom}
          photoTags={(listingAny?.photo_tags as import('@/types/floorPlan').PhotoTag[]) ?? []}
          variant={
            ((listingAny?.gallery_layout as 'hero' | 'mosaic' | 'carousel' | undefined) ?? 'hero')
          }
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

      {/* ── Split Body (proto megga-bien-page.jsx: maxWidth 1280, 1fr 380px, gap 32) ── */}
      <div
        className="bien-split-body"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 clamp(20px, 4vw, 32px) 60px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* Left column — proto: gap 20 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <BienPriceCard
            price={listing.price}
            priceOriginal={(listing as { price_original?: number | null }).price_original ?? null}
            mode={mode}
            surface={listing.surface_m2}
            charges={listing.charges_monthly}
            rooms={listing.rooms}
            bedrooms={listing.bedrooms}
            bathrooms={listing.bathrooms}
          />
          {(listing as { c2pa_verified?: boolean; c2pa_verified_at?: string }).c2pa_verified && (
            <C2PaBadge
              verified={(listing as { c2pa_verified?: boolean }).c2pa_verified || false}
              verifiedAt={(listing as { c2pa_verified_at?: string }).c2pa_verified_at}
            />
          )}

          <ListingDescription description={listing.description} />

          <BienSpecsBlock
            bienId={listing.id}
            type={listing.type}
            yearBuilt={yearBuilt}
            floor={listing.floor}
            surfaceM2={listing.surface_m2}
            hasElevator={(listing as { has_elevator?: boolean }).has_elevator ?? null}
            chargesMonthly={listing.charges_monthly}
            hasGarage={(listing as { has_garage?: boolean }).has_garage ?? null}
            hasParking={(listing as { has_parking?: boolean }).has_parking ?? null}
            equipments={equipmentsList}
          />

          <BienEnergyBlock
            energyLabel={(listing as { energy_label?: string | null }).energy_label ?? null}
            energyKwh={(listing as { energy_kwh?: number | null }).energy_kwh ?? null}
            energyYear={(listing as { energy_year?: number | null }).energy_year ?? null}
          />

          {/* Floor Plan Interactif (kept inside left column) */}
          {floorPlanUrl && floorPlanHotspots.length > 0 && (
            <div
              id="plan"
              className="scroll-mt-28"
              style={{
                background: '#fff',
                border: '1px solid #DDE2EA',
                borderRadius: 14,
                padding: 22,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0E1410', marginBottom: 16 }}>
                Plan interactif
              </h2>
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

          {/* Quartier (port proto NeighborhoodBlock — variant map Leaflet) */}
          <BienNeighborhoodBlock
            neighborhood={listing.city || listing.canton || ''}
            variant="map"
            bienId={listing.id}
            title={listing.title}
            type={listing.type}
            addr={listing.address}
            lat={listing.lat}
            lng={listing.lng}
          />

          <BienDocumentsBlock />
        </div>

        {/* Right column — sticky agent card (proto: 380px, partenaire Naef) */}
        <div className="bien-sidebar" style={{ minWidth: 0 }}>
          <BienAgentCard
            agent={{
              name: resolvedAgent.name,
              agency: resolvedAgent.agency,
              phone: resolvedAgent.phone || '',
              email: resolvedAgent.email,
              photo: resolvedAgent.photo || null,
            }}
            bienId={listing.id}
            partnerKey="naef"
            soldThisYear={12}
            rating={4.8}
            ratingCount={64}
            langs={['FR', 'EN']}
            status={(listing as { status?: string }).status as 'available' | 'compromis' | 'sold' | undefined}
            isFavorite={isFavorite}
            onToggleFavorite={() => setIsFavorite(!isFavorite)}
            onAskVisit={() => setShowVisitModal(true)}
            onContact={() => setShowContactModal(true)}
          />
        </div>
      </div>

      {/* Responsive: collapse to single column under 1024 */}
      <style>{`
        @media (max-width: 1023px) {
          .bien-split-body { grid-template-columns: 1fr !important; }
          .bien-sidebar { display: none !important; }
        }
      `}</style>

      {/* ── Similar Listings (proto megga-bien-similar.jsx) ── */}
      <BienSimilarBlock
        listings={similarListings}
        type={listing.type}
        canton={listing.canton}
        mode={mode}
      />

      {/* ── Footer (proto MEGGA_FooterMega) ── */}
      <FooterMega />

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
