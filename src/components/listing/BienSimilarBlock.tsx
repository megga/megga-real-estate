// MEGGA — Biens similaires (port 1:1 du proto megga-bien-similar.jsx).
// Section pleine largeur sur fond #F6F8F4, padding 60px 0, marginTop 40.
// Header : eyebrow "POUR VOUS" bleu + h2 "Biens similaires" 28px + caption +
//          lien "Voir tous les biens →" top-right.
// Grid : repeat(3, 1fr), gap 16, cartes radius 14 avec hover translateY + shadow.

import { Link } from 'react-router-dom'
import { formatCHF, formatSurface } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import type { ListingCardData } from '@/components/listings/ListingCard'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
  bandBg: '#F6F8F4',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

const TYPE_LABEL: Record<string, string> = {
  appartement: 'Appartement',
  apartment: 'Appartement',
  maison: 'Maison',
  house: 'Maison',
  villa: 'Villa',
  chalet: 'Chalet',
  loft: 'Loft',
  studio: 'Studio',
  terrain: 'Terrain',
  land: 'Terrain',
}

interface BienSimilarBlockProps {
  listings: ListingCardData[]
  type?: string | null
  canton?: string | null
  mode?: 'louer' | 'acheter'
  /** Lien "Voir tous les biens" — par défaut /buy ou /rent */
  searchHref?: string
  count?: number
}

interface SimilarCardProps {
  listing: ListingCardData
  mode: 'louer' | 'acheter'
}

function SimilarCard({ listing, mode }: SimilarCardProps) {
  const photo = listing.photos?.[0]
  const isLouer = mode === 'louer'
  const price = isLouer
    ? `${formatCHF(listing.price)}/mo`
    : formatCHF(listing.price)

  return (
    <Link
      to={`/propriete/${listing.id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(14,20,16,0.10)'
        e.currentTarget.style.borderColor = M.muted
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = M.border
      }}
    >
      <div
        style={{
          height: 180,
          backgroundImage: photo
            ? `url(${optimizeImageUrl(photo, IMAGE_PRESETS.card)})`
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: photo ? undefined : '#F2F4F8',
        }}
      />
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 700,
            color: M.ink,
            marginBottom: 4,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {listing.title}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 12,
            color: M.muted,
            marginBottom: 10,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {listing.address}
          {listing.city && `, ${listing.city}`}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 800,
              color: M.ink,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.2,
            }}
          >
            {price}
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11,
              color: M.soft,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {listing.rooms > 0 && `${listing.rooms} p`}
            {listing.rooms > 0 && listing.surface_m2 > 0 && ' · '}
            {listing.surface_m2 > 0 && formatSurface(listing.surface_m2)}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function BienSimilarBlock({
  listings,
  type,
  canton,
  mode = 'acheter',
  searchHref,
  count = 3,
}: BienSimilarBlockProps) {
  if (!listings.length) return null

  const picks = listings.slice(0, count)
  const typeLabel = type ? TYPE_LABEL[type.toLowerCase()] || type[0].toUpperCase() + type.slice(1) : ''
  const captionParts: string[] = []
  if (typeLabel) captionParts.push(typeLabel)
  if (canton) captionParts.push(canton)
  captionParts.push('±30% prix')
  const defaultHref = mode === 'louer' ? '/rent' : '/buy'

  return (
    <div
      id="similaires"
      className="scroll-mt-28"
      style={{
        background: M.bandBg,
        padding: '60px 0',
        marginTop: 40,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 clamp(20px, 4vw, 32px)',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: M.green,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Pour vous
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: M.ink,
                margin: 0,
                letterSpacing: -0.6,
              }}
            >
              Biens similaires
            </h2>
            <div style={{ fontSize: 14, color: M.muted, marginTop: 4 }}>
              {captionParts.join(' · ')}
            </div>
          </div>
          <Link
            to={searchHref || defaultHref}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: M.ink,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Voir tous les biens →
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(picks.length, 4)}, minmax(0, 1fr))`,
            gap: 16,
          }}
        >
          {picks.map(l => (
            <SimilarCard key={l.id} listing={l} mode={mode} />
          ))}
        </div>
      </div>
    </div>
  )
}
