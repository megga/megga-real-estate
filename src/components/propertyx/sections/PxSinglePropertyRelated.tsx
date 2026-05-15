// MEGGA Marketplace — Property X "Single Property — More properties" section.
// Source : Figma node 11781:17016 — code Figma EXACT.
//
// Anatomie :
// - py 120, container 1200 centré
// - Top : H2 "More properties" 48 + Link "Browse all properties" + chevron
// - Grid 2 cartes 588×520 (image 588×364 rounded-24 avec badges overlay)
// - Card : image + badge type pill + plus circle button → titre 24 + location →
//   divider → amenities inline + lien "Contact agent"
//
// Icônes : 100% PxFigmaIcon (vrais SVG du fichier Figma) — pas de SVG manuel.
// V34 = key (For rent) · V35 = tag (For sale) · V37 = location · V31 = surface
// V23 = bed · V33 = bath · V27 = parking · chevron-right · plus

import type { CSSProperties, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { PX, PxFigmaIcon, PxIcon } from '..'
import { useRelatedListings } from '@/hooks/useRelatedListings'
import { useFavorites } from '@/hooks/useFavorites'
import { useAuth } from '@/hooks/useAuth'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface PxSinglePropertyRelatedProps {
  currentListing?: ListingCardData
}

// ─── Sub-components ────────────────────────────────────────────────────

const metaLabel: CSSProperties = {
  fontFamily: PX.font.sans,
  fontWeight: 500,
  fontSize: 16,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  color: PX.neutral400,
  whiteSpace: 'nowrap',
  paddingTop: 2,
}

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={metaLabel}>{label}</span>
    </div>
  )
}

interface PropertyCardData {
  id?: string // prefixed id (market-... / internal-...) — pour le lien détail
  image: string
  badge: { kind: 'rent' | 'sale'; label: string }
  title: string
  location: string
  sqft: string
  beds: number
  baths: number
  parking: number
}

function PropertyCard({ data }: { data: PropertyCardData }) {
  // Figma : badge For rent utilise "Small Icon/V34" = key, For sale utilise "V35" = tag.
  const badgeIcon = data.badge.kind === 'rent' ? 'key' : 'tag'
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorite = data.id ? isFavorite(data.id) : false

  const handleFavoriteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (data.id) toggleFavorite(data.id, !!user)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      width: '100%',
      minWidth: 0,
    }}>
      {/* Image */}
      <div style={{
        position: 'relative',
        background: PX.neutral500,
        height: 364,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        width: '100%',
      }}>
        <img
          src={data.image}
          alt={data.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Overlay : badge + plus circle */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            background: PX.neutral700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: PX.radius.pill,
          }}>
            <PxFigmaIcon name={badgeIcon} size={16} color={PX.neutral100} />
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
              paddingTop: 2,
            }}>
              {data.badge.label}
            </span>
          </div>
          <button
            type="button"
            aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={favorite}
            onClick={handleFavoriteClick}
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              background: favorite ? PX.neutral700 : PX.neutral100,
              border: 0,
              boxShadow: PX.shadow.small,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.18s ease',
            }}
          >
            <PxIcon name="heart" size={16} color={favorite ? PX.neutral100 : PX.neutral700} />
          </button>
        </div>
      </div>

      {/* Bottom content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>
          {data.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral700} />
          <span style={{
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            paddingTop: 6,
          }}>
            {data.location}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, width: '100%', background: PX.neutral300 }} />

      {/* Footer — amenities + link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <MetaItem icon={<PxFigmaIcon name="surface" size={20} color={PX.neutral400} />} label={data.sqft} />
          <MetaItem icon={<PxFigmaIcon name="bed" size={20} color={PX.neutral400} />} label={String(data.beds)} />
          <MetaItem icon={<PxFigmaIcon name="bath" size={20} color={PX.neutral400} />} label={String(data.baths)} />
          <MetaItem icon={<PxFigmaIcon name="parking" size={20} color={PX.neutral400} />} label={String(data.parking)} />
        </div>
        <Link
          to={data.id ? `/propriete/${data.id}` : '#'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            paddingTop: 2,
          }}>
            Voir le bien
          </span>
          <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
        </Link>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────

const PROPERTIES: PropertyCardData[] = [
  {
    image: '/images/sections/single-property/related-1.jpg',
    badge: { kind: 'rent', label: 'À louer' },
    title: 'Loft lumineux au cœur de Genève',
    location: 'Rue de la Servette, Genève',
    sqft: '120 m²',
    beds: 3,
    baths: 2,
    parking: 1,
  },
  {
    image: '/images/sections/single-property/related-2.jpg',
    badge: { kind: 'sale', label: 'À vendre' },
    title: 'Villa contemporaine à Lausanne',
    location: 'Avenue de Cour, Lausanne',
    sqft: '210 m²',
    beds: 4,
    baths: 3,
    parking: 2,
  },
]

function listingToCardData(listing: ListingCardData): PropertyCardData {
  const isRent = listing.context === 'rent'
  return {
    id: listing.id,
    image: listing.photos?.[0] ?? '/images/sections/single-property/related-1.jpg',
    badge: {
      kind: isRent ? 'rent' : 'sale',
      label: isRent ? 'À louer' : 'À vendre',
    },
    title: listing.title,
    location: [listing.address, listing.city].filter(Boolean).join(', ') || (listing.canton ?? ''),
    sqft: listing.surface_m2 ? `${listing.surface_m2} m²` : '—',
    beds: listing.rooms ?? 0,
    baths: listing.bathrooms ?? 0,
    parking: 0,
  }
}

export default function PxSinglePropertyRelated({ currentListing }: PxSinglePropertyRelatedProps) {
  // Strip prefix (market-/internal-) pour la query .neq sur le raw id
  const rawId = currentListing?.id.replace(/^(market-|internal-)/, '')
  const browseHref = currentListing?.context === 'rent' ? '/louer' : '/acheter'

  const { data: related } = useRelatedListings({
    canton: currentListing?.canton,
    context: currentListing?.context,
    type: currentListing?.type,
    excludeId: rawId,
  })

  const cards = currentListing && related && related.length > 0
    ? related.map(listingToCardData)
    : PROPERTIES

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      paddingTop: 120,
      paddingBottom: 120,
      background: PX.pageBg,
    }}>
      <div style={{
        width: 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
      }}>
        {/* Top — title + link */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingBottom: 24,
          gap: 16,
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>
            Biens similaires
          </h2>
          <Link
            to={browseHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              paddingTop: 2,
            }}>
              Tous les biens
            </span>
            <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
          </Link>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 24,
          paddingTop: 24,
        }}>
          {cards.map((p) => (
            <PropertyCard key={p.id ?? p.title} data={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
