// MEGGA Marketplace — Property X "Articles Section" listings grid.
// Source : Figma node 9552:21447 — sous-frame "Articles Section" (9680:9298)
// + "Properties Card/V2" (11781:16157 et 11781:16208).
//
// Structure :
//   <section pt-120 pb-160 flex-col items-center>
//     <Cards Wrapper gap-24 justify-center>
//       <PropertyCard w-588 — Image 364h + Badge + Plus + Content + Divider + Amenities + Link>
//       <PropertyCard w-588>
//     </Cards Wrapper>
//   </section>

import { PX, PxIcon } from '..'

interface Listing {
  id: string
  title: string
  address: string
  image: string
  // Amenities ordre Figma : sqft, beds, baths, parking
  sqft: string
  beds: string
  baths: string
  parking: string
}

const LISTINGS: Listing[] = [
  {
    id: 'la',
    title: 'Home in Los Angeles Heart',
    address: '2238 Stradella Rd, LA',
    // Unsplash : intérieur moderne lumineux LA-ish
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=85',
    sqft: '8,392 sqtf',
    beds: '3',
    baths: '2',
    parking: '3',
  },
  {
    id: 'sf',
    title: 'Modern Loft in San Francisco',
    address: '1,334 sqtf',
    // Unsplash : loft moderne avec verrière
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1400&q=85',
    sqft: '1,334 sqtf',
    beds: '1',
    baths: '2',
    parking: '1',
  },
]

function ForSaleCardBadge() {
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
      {/* Star icon size 16 white (Figma : size-16, pas de circle inner) */}
      <PxIcon name="star" size={16} color={PX.neutral100} strokeWidth={1.6} />
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
        For sale
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
        <PxIcon name={icon} size={20} color={PX.neutral400} strokeWidth={1.7} />
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

function PropertyCardV2({ listing }: { listing: Listing }) {
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
      {/* Image card : 364h rounded-24 bg-neutral500, overlay top flex */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 364,
          background: PX.neutral500,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
        }}
      >
        {/* Photo background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${listing.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Top overlay : p-24 flex justify-between */}
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
          <ForSaleCardBadge />
          {/* Circle button 40px bg-white shadow-small + plus icon noir */}
          <button
            type="button"
            aria-label="Voir le bien"
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              background: PX.neutral100,
              border: 0,
              cursor: 'pointer',
              boxShadow: PX.shadow.small,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <PxIcon name="plus" size={16} color={PX.neutral700} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Bottom Content : flex-col gap-6 items-start */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}
      >
        {/* Title 24/medium tracking-0.72 neutral700 */}
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
          }}
        >
          {listing.title}
        </h3>
        {/* Details : location icon-20 + 16/medium neutral700 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PxIcon name="location" size={20} color={PX.neutral700} strokeWidth={1.7} />
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
            }}
          >
            {listing.address}
          </span>
        </div>
      </div>

      {/* Divider 1px neutral300 */}
      <div
        style={{
          height: 1,
          width: '100%',
          background: PX.neutral300,
          flexShrink: 0,
        }}
      />

      {/* Flex Horizontal : Amenities gap-24 + Contact agent link */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <AmenityItem icon="surface" value={listing.sqft} />
          <AmenityItem icon="bed" value={listing.beds} />
          <AmenityItem icon="bath" value={listing.baths} />
          <AmenityItem icon="parking" value={listing.parking} />
        </div>
        {/* Link "Contact agent" : 16/medium neutral700 + chevron-right size-16 */}
        <a
          href={`/agents`}
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
            Contact agent
          </span>
          <PxIcon name="chevron-right" size={16} color={PX.neutral700} strokeWidth={2} />
        </a>
      </div>
    </article>
  )
}

export default function PxListingsGrid() {
  return (
    <section
      style={{
        width: '100%',
        paddingTop: 120,
        paddingBottom: 160,
        background: PX.neutral200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        zIndex: 2,
      }}
    >
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
        {LISTINGS.map(l => <PropertyCardV2 key={l.id} listing={l} />)}
      </div>
    </section>
  )
}
