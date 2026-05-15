// MEGGA Marketplace — Property X "Articles Section" listings grid.
// Source : Figma node 9552:21447 — sous-frame "Articles Section" (9680:9298)
// + "Properties Card/V2" (11781:16157 et 11781:16208).
//
// Branché sur Supabase via useMarketListings (infinite query, paginé par
// 24 biens). Les filtres sont lus depuis l'URL via useMarketFilters — la grid
// se re-rend automatiquement quand les query params changent (canton, type,
// price, rooms, surface, sort, q).

import { Link } from 'react-router-dom'
import { PX, PxFigmaIcon, PxGoodDealBadge } from '..'
import {
  useMarketListings,
  useCantonalMedians,
  isGoodDeal,
  type CantonalMedianLookup,
} from '@/hooks/useMarketListings'
import { useMarketFilters } from '@/hooks/useMarketFilters'
import { useUserPois, type UserPoi } from '@/hooks/useUserPois'
import { useTravelTimes, type ListingTravelTimes } from '@/hooks/useTravelTimes'
import { formatTravelDuration } from '@/lib/mapboxClient'
import { formatCHF, formatRent } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'
import PxListingsSortSelector from './PxListingsSortSelector'

interface PxListingsGridProps {
  context: 'buy' | 'rent'
}

function PriceBadge({ context, price }: { context: 'buy' | 'rent'; price: number }) {
  const label = context === 'rent' ? formatRent(price) : formatCHF(price)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral700,
        borderRadius: PX.radius.pill,
      }}
    >
      <PxFigmaIcon name="tag" size={15.207} color={PX.neutral100} />
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  )
}

function AmenityItem({ icon, value }: { icon: 'surface' | 'bed' | 'bath' | 'parking'; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span
        style={{
          width: 20,
          height: 20,
          display: 'inline-grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <PxFigmaIcon name={icon} size={20} color={PX.neutral400} />
      </span>
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Travel time row (Phase 3) ──────────────────────────────────────────────
//
// Affiche les durées de trajet en voiture vers les POIs sauvegardés. Si la
// matrice n'est pas encore calculée (loading / pas de POIs), rien n'est
// affiché — fail-soft.

function TravelTimeRow({
  travelTimes,
  pois,
}: {
  travelTimes: ListingTravelTimes | null
  pois: UserPoi[]
}) {
  if (!travelTimes || pois.length === 0) return null
  const labelByPoi = new Map(pois.map(p => [p.id, p.label]))
  const validEntries = travelTimes.perPoi
    .filter(e => typeof e.durationSec === 'number')
    .slice(0, 3) // max 3 displayed
  if (validEntries.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        paddingTop: 2,
      }}
    >
      <PxFigmaIcon name="location" size={14} color={PX.neutral500} />
      {validEntries.map((e, idx) => (
        <span
          key={e.poiId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: PX.font.display,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.39px',
            color: PX.neutral500,
          }}
        >
          <span style={{ color: PX.neutral700 }}>{formatTravelDuration(e.durationSec)}</span>
          <span>de {labelByPoi.get(e.poiId) ?? '?'}</span>
          {idx < validEntries.length - 1 && (
            <span style={{ color: PX.neutral400, marginLeft: 4 }}>·</span>
          )}
        </span>
      ))}
    </div>
  )
}

function PropertyCardV2({
  listing,
  context,
  medianLookup,
  travelTimes,
  pois,
}: {
  listing: ListingCardData
  context: 'buy' | 'rent'
  medianLookup: CantonalMedianLookup
  travelTimes: ListingTravelTimes | null
  pois: UserPoi[]
}) {
  const image = listing.photos?.[0] ?? ''
  const cityLabel = [listing.address, listing.city].filter(Boolean).join(', ')
  const surfaceLabel = listing.surface_m2 ? `${listing.surface_m2} m²` : '—'
  const roomsLabel = listing.rooms ? `${listing.rooms} p.` : '—'
  const bedroomsLabel = listing.bedrooms ? String(listing.bedrooms) : '—'
  const bathroomsLabel = listing.bathrooms ? String(listing.bathrooms) : '—'

  // "Bon prix" : prix/m² ≤ 85% médiane (canton × tx_type × type)
  const median = medianLookup({
    canton: listing.canton,
    transaction_type: context,
    type: listing.type,
  })
  const goodDeal = isGoodDeal(listing.price_per_m2, median)
  const discountPct = goodDeal && median
    ? Math.round((1 - (listing.price_per_m2 ?? 0) / median.median_price_per_m2) * 100)
    : undefined

  return (
    <article
      style={{
        width: 588,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        flexShrink: 0,
      }}
    >
      <Link
        to={`/propriete/${listing.id}`}
        style={{
          position: 'relative',
          width: '100%',
          height: 364,
          background: PX.neutral500,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
          display: 'block',
          textDecoration: 'none',
        }}
      >
        {image && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${image}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: 24,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
              minWidth: 0,
            }}
          >
            <PriceBadge context={context} price={listing.price} />
            {goodDeal && <PxGoodDealBadge discountPct={discountPct} />}
          </div>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              background: PX.neutral100,
              boxShadow: PX.shadow.small,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <PxFigmaIcon name="plus" size={16} color={PX.neutral700} />
          </span>
        </div>
      </Link>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {listing.title}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral700} />
          <span
            style={{
              paddingTop: 6,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 500,
            }}
          >
            {cityLabel}
          </span>
        </div>
      </div>

      <div
        style={{
          height: 1,
          width: '100%',
          background: PX.neutral300,
          flexShrink: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <AmenityItem icon="surface" value={surfaceLabel} />
          <AmenityItem icon="bed" value={roomsLabel} />
          {listing.bedrooms ? <AmenityItem icon="bed" value={bedroomsLabel} /> : null}
          {listing.bathrooms ? <AmenityItem icon="bath" value={bathroomsLabel} /> : null}
        </div>
        <Link
          to={`/propriete/${listing.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              paddingTop: 2,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}
          >
            Voir le bien
          </span>
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral700} />
        </Link>
      </div>

      {/* Phase 3 — Travel time row : affiché uniquement si pois > 0 ET que la
          matrice est calculée pour ce listing. Fail-soft sinon. */}
      <TravelTimeRow travelTimes={travelTimes} pois={pois} />
    </article>
  )
}

function StatusBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        width: '100%',
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: PX.font.display,
        fontSize: 18,
        color: PX.neutral400,
      }}
    >
      {message}
    </div>
  )
}

export default function PxListingsGrid({ context }: PxListingsGridProps) {
  const { filters } = useMarketFilters(context)
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMarketListings(filters)

  // Médianes cantonales pour le badge "Bon prix". Cache 24h (matche le
  // refresh pg_cron côté DB). Fail-soft : si la matview n'existe pas, le
  // lookup retourne null → pas de badge, le reste de la grid fonctionne.
  const { data: mediansData } = useCantonalMedians()
  const medianLookup: CantonalMedianLookup = mediansData?.lookup ?? (() => null)

  const listings = data?.pages.flatMap(p => p.listings) ?? []
  const showEmpty = !isLoading && !isError && listings.length === 0

  // Phase 3 — Mes lieux : calcul des temps de trajet vers les POIs sauvegardés.
  // useTravelTimes batche 1 seule requête Matrix par page de listings (max
  // 22 listings × 3 POIs = 66 cellules < limite 625). Fail-soft : si Mapbox
  // down ou pas de POIs, retourne undefined → TravelTimeRow ne s'affiche pas.
  const { pois } = useUserPois()
  const { data: travelTimesMap } = useTravelTimes({
    pois,
    listings: listings.map(l => ({ id: l.id, lat: l.lat, lng: l.lng })),
  })

  return (
    <section
      style={{
        width: '100%',
        paddingTop: 24,
        paddingBottom: 160,
        background: PX.neutral200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Top bar : sort selector aligned right. Aligned with the grid's max-width. */}
      <div
        style={{
          width: '100%',
          maxWidth: 1392,
          paddingLeft: 24,
          paddingRight: 24,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <PxListingsSortSelector context={context} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          justifyContent: 'center',
          maxWidth: 'calc(100% - 48px)',
          flexWrap: 'wrap',
        }}
      >
        {isLoading && <StatusBlock message="Chargement des biens…" />}
        {isError && <StatusBlock message="Impossible de charger les biens. Réessayez plus tard." />}
        {showEmpty && (
          <StatusBlock message="Aucun bien ne correspond à vos filtres. Essayez d'élargir votre recherche." />
        )}
        {!isLoading && !isError && listings.map(l => (
          <PropertyCardV2
            key={l.id}
            listing={l}
            context={context}
            medianLookup={medianLookup}
            travelTimes={travelTimesMap?.get(l.id) ?? null}
            pois={pois}
          />
        ))}
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={{
            padding: '14px 28px',
            background: PX.neutral700,
            color: PX.neutral100,
            border: 0,
            borderRadius: PX.radius.pill,
            cursor: isFetchingNextPage ? 'not-allowed' : 'pointer',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.48px',
            opacity: isFetchingNextPage ? 0.6 : 1,
          }}
        >
          {isFetchingNextPage ? 'Chargement…' : 'Voir plus de biens'}
        </button>
      )}
    </section>
  )
}
