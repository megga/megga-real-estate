// MEGGA — Market search card (port 1:1 du proto megga-search-results.jsx ResultCard).
// Drop-in replacement de SearchListingCard avec la même prop interface.
//
// Différences vs ancienne SearchListingCard :
// - Manrope + tokens proto (#FAFBFD/#0E1410/#DDE2EA/#0041D9)
// - Border 14px radius (vs 16px)
// - Hover translate-Y -2px + shadow (vs scale)
// - Badges top-left distincts À louer (ink) / À vendre (green) + Neuf
// - Heart 32px sans chip (vs Lucide Heart 18px chip blanc)
// - Photo count bottom-right (icon + count)
// - Title 16px 700 + price right-aligned avec strikethrough si baisse
// - Stats inline avec icones SVG inline (vs Lucide)
// - Footer agent : avatar 22px initiales + nom + "Voir le bien →"

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCHF } from '@/lib/utils'
import { pickPhoto } from '@/lib/listingPhotos'
import type { ListingCardData } from '@/components/listings/ListingCard'

const M = {
  ink: '#0E1410',
  soft: '#4A5249',
  muted: '#847D6E',
  border: '#DDE2EA',
  card: '#FFFFFF',
  section: '#F2F4F8',
  green: '#0041D9', // MEGGA blue brand (proto naming)
  greenAccent: '#1A7A3A', // green for price-reduced highlight
  greenAccentBg: '#E6F5EA',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

// ── Inline icons (port du proto) ─────────────────────────────────────────

function IcoBeds() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1 9V5a1 1 0 011-1h10a1 1 0 011 1v4M1 9v3M13 9v3M1 9h12M3 7V5h3v2" />
    </svg>
  )
}

function IcoArea() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 2h10v10H2z M2 6h4v6 M6 2v4h6" />
    </svg>
  )
}

function IcoBaths() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 7h10v3a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM4 7V3a2 2 0 014 0M3 12l-1 1M11 12l1 1" />
    </svg>
  )
}

function IcoPin() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 11s4-3.5 4-7a4 4 0 10-8 0c0 3.5 4 7 4 7z" />
      <circle cx="6" cy="4.5" r="1.5" />
    </svg>
  )
}

function IcoHeart({ filled, size = 32 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? '#E53935' : '#0E1410'}
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))' }}
    >
      <path d="M8 14s-5.5-3.5-5.5-7.5A3.5 3.5 0 018 4a3.5 3.5 0 015.5 2.5C13.5 10.5 8 14 8 14z" />
    </svg>
  )
}

function IcoCamera() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="2" width="8" height="6" rx="1" />
      <circle cx="5" cy="5" r="1.4" />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────

interface MarketSearchCardProps {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
  /** Selected (clicked / opened in preview) — gives the design proto's ink border */
  isSelected?: boolean
  eager?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  isCompared?: boolean
  onToggleCompare?: () => void
  /** Médiane du prix au m² du marché (pour calcul "below market") */
  medianPricePerM2?: number
  onPreview?: (id: string) => void
}

// ── Component ────────────────────────────────────────────────────────────

export default function MarketSearchCard({
  listing,
  onHover,
  isHovered = false,
  isSelected = false,
  eager: _eager = false,
  isFavorite = false,
  onToggleFavorite,
  isCompared: _isCompared = false,
  onToggleCompare: _onToggleCompare,
  medianPricePerM2: _medianPricePerM2 = 0,
  onPreview,
}: MarketSearchCardProps) {
  void _eager
  void _isCompared
  void _onToggleCompare
  void _medianPricePerM2

  const { i18n } = useTranslation('common')
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const isLouer = listing.context === 'rent'
  const photo = useMemo(() => pickPhoto(listing, 0, 'detail'), [listing])
  const photoCount = listing.photos?.length || 0

  const currentPrice = listing.price
  const dropPct = listing.price_drop_pct && listing.price_drop_pct >= 1 ? listing.price_drop_pct : 0
  const hasDrop = dropPct > 0 && !isLouer
  // Reverse-derive original price: current = original * (1 - dropPct/100)
  const originalPrice = hasDrop ? Math.round(currentPrice / (1 - dropPct / 100)) : null
  const priceLabel = isLouer
    ? `${formatCHF(currentPrice)} /mois`
    : formatCHF(currentPrice)
  const ppm =
    !isLouer && listing.surface_m2 > 0
      ? Math.round(currentPrice / listing.surface_m2)
      : null

  const lang = (i18n.language?.slice(0, 2) || 'fr') as string
  void lang

  const isHov = hovering || isHovered

  // Agent initials
  const initials = listing.agent?.name
    ? listing.agent.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '—'

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onMouseEnter={() => {
        setHovering(true)
        onHover?.(listing.id)
      }}
      onMouseLeave={() => {
        setHovering(false)
        onHover?.(undefined)
      }}
      onClick={() => onPreview?.(listing.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview?.(listing.id)
        }
      }}
      style={{
        background: M.card,
        borderRadius: 14,
        overflow: 'hidden',
        // Design proto: 3 border states — selected (ink) / hover (muted) / idle
        border: `1px solid ${isSelected ? M.ink : isHov ? M.muted : M.border}`,
        cursor: 'pointer',
        transition:
          'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.2s ease',
        transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHov
          ? '0 14px 30px rgba(14,20,16,0.10)'
          : '0 1px 2px rgba(14,20,16,0.04)',
        fontFamily: FONT,
      }}
    >
      {/* Image area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 200,
          background: M.section,
          backgroundImage: photo ? `url(${photo})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Badges top-left */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <div
            style={{
              padding: '4px 9px',
              borderRadius: 999,
              background: isLouer ? M.ink : M.green,
              // Design proto: À louer = white text on ink, À vendre = ink text on blue
              color: isLouer ? '#fff' : M.ink,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {isLouer ? 'À louer' : 'À vendre'}
          </div>
          {listing.is_new && (
            <div
              style={{
                padding: '4px 9px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(6px)',
                color: M.ink,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Neuf
            </div>
          )}
          {listing.is_exclusive && (
            <div
              style={{
                padding: '4px 9px',
                borderRadius: 999,
                background: 'rgba(232, 177, 75, 0.95)',
                color: M.ink,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Exclusif
            </div>
          )}
        </div>

        {/* Heart top-right (no chip, just icon) */}
        <button
          onClick={e => {
            e.stopPropagation()
            onToggleFavorite?.()
          }}
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.12)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <IcoHeart filled={isFavorite} size={32} />
        </button>

        {/* Photo count bottom-right */}
        {photoCount > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(14,20,16,0.7)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <IcoCamera />
            {photoCount}
          </div>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: 16 }}>
        {/* Top: title + price */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <h3
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 700,
              color: M.ink,
              margin: 0,
              letterSpacing: -0.3,
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {listing.title}
          </h3>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {/* Design proto: original price line-through above when there's a drop */}
            {originalPrice && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  color: M.muted,
                  fontVariantNumeric: 'tabular-nums',
                  textDecoration: 'line-through',
                  marginBottom: 1,
                }}
              >
                {formatCHF(originalPrice)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 16,
                  fontWeight: 800,
                  // Design: green when price was reduced
                  color: hasDrop ? '#1A7A3A' : M.ink,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {priceLabel}
              </div>
              {hasDrop && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: '#E6F5EA',
                    color: '#1A7A3A',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.2,
                  }}
                >
                  -{Math.round(dropPct)}%
                </span>
              )}
            </div>
            {ppm !== null && (
              <div
                style={{
                  fontSize: 10,
                  color: M.muted,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                }}
              >
                {formatCHF(ppm)}/m²
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: M.muted,
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          <IcoPin />
          {listing.address || listing.city}
          {listing.canton && ` · ${listing.canton}`}
        </div>

        {/* Stats inline */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontSize: 12,
            color: M.soft,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            flexWrap: 'wrap',
          }}
        >
          {listing.rooms > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IcoBeds /> {listing.rooms} pièces
            </span>
          )}
          {listing.surface_m2 > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IcoArea /> {listing.surface_m2} m²
            </span>
          )}
          {listing.bedrooms > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IcoBaths /> {listing.bedrooms}
            </span>
          )}
        </div>

        {/* Footer: agent */}
        {listing.agent && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: `1px solid ${M.border}`,
              marginTop: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: '#E0E5DA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: M.ink,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: M.muted,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {listing.agent.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: M.muted,
                fontWeight: 600,
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              Voir le bien →
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
