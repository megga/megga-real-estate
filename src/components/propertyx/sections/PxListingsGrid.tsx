// MEGGA Marketplace — Property X "Articles Section" listings grid.
// Source : Figma node 9552:21447 — sous-frame "Articles Section" (9680:9298)
// + "Properties Card/V2" (11781:16157 et 11781:16208).
//
// Branché sur Supabase via useMarketListings (infinite query, paginé par
// 24 biens). Les filtres sont lus depuis l'URL via useMarketFilters — la grid
// se re-rend automatiquement quand les query params changent (canton, type,
// price, rooms, surface, sort, q).

import { Link } from 'react-router-dom'
import { PX, PxFigmaIcon } from '..'
import { useMarketListings } from '@/hooks/useMarketListings'
import { useMarketFilters } from '@/hooks/useMarketFilters'
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

function PropertyCardV2({ listing, context }: { listing: ListingCardData; context: 'buy' | 'rent' }) {
  const image = listing.photos?.[0] ?? ''
  const cityLabel = [listing.address, listing.city].filter(Boolean).join(', ')
  const surfaceLabel = listing.surface_m2 ? `${listing.surface_m2} m²` : '—'
  const roomsLabel = listing.rooms ? `${listing.rooms} p.` : '—'
  const bedroomsLabel = listing.bedrooms ? String(listing.bedrooms) : '—'
  const bathroomsLabel = listing.bathrooms ? String(listing.bathrooms) : '—'

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
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PriceBadge context={context} price={listing.price} />
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

  const listings = data?.pages.flatMap(p => p.listings) ?? []
  const showEmpty = !isLoading && !isError && listings.length === 0

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
          <PropertyCardV2 key={l.id} listing={l} context={context} />
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
