import { useState, useRef, useEffect } from 'react'
import {
  Heart, Building2, GitCompareArrows, Check,
  DoorOpen, BedDouble, Maximize, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { getSmartBadge } from '@/lib/searchFilters'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface SearchListingCardProps {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  isCompared?: boolean
  onToggleCompare?: () => void
  medianPricePerM2?: number
  onPreview?: (id: string) => void
}

export default function SearchListingCard({
  listing,
  onHover,
  isHovered,
  isFavorite: isFav = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  medianPricePerM2 = 0,
  onPreview,
}: SearchListingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const photos = listing.photos?.length ? listing.photos : []

  useEffect(() => {
    if (isHovered && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isHovered])

  const badge = getSmartBadge(listing, medianPricePerM2)

  return (
    <div
      ref={cardRef}
      onClick={() => onPreview?.(listing.id)}
      className={cn(
        'block bg-white border rounded-lg transition-all duration-200 overflow-hidden group cursor-pointer',
        isHovered
          ? 'border-accent/40 ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {photos.length > 0 ? (
          <img
            src={photos[currentPhoto]}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm'
            )}
          >
            {badge.label}
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.() }}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'h-7 w-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isFav ? 'bg-white/95' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            <Heart className={cn('h-3.5 w-3.5 transition-colors', isFav ? 'fill-red-500 text-red-500' : 'text-white/90')} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCompare?.() }}
            aria-label={isCompared ? 'Retirer de la comparaison' : 'Comparer'}
            className={cn(
              'h-7 w-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 cursor-pointer',
              isCompared ? 'bg-white/95 ring-1 ring-accent/40' : 'bg-black/15 hover:bg-black/25'
            )}
          >
            {isCompared ? <Check className="h-3 w-3 text-accent" /> : <GitCompareArrows className="h-3 w-3 text-white/90" />}
          </button>
        </div>
        {(isFav || isCompared) && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 group-hover:hidden">
            {isFav && (
              <div className="h-7 w-7 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center">
                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              </div>
            )}
            {isCompared && (
              <div className="h-7 w-7 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center ring-1 ring-accent/40">
                <Check className="h-3 w-3 text-accent" />
              </div>
            )}
          </div>
        )}
        {photos.length > 1 && (
          <>
            {currentPhoto > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p - 1) }}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
            )}
            {currentPhoto < photos.length - 1 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p + 1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/30"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            )}
          </>
        )}
        {photos.length > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-[1]">
              {photos.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCurrentPhoto(i)
                  }}
                  className={cn(
                    'rounded-full transition-all cursor-pointer',
                    currentPhoto === i ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'
                  )}
                />
              ))}
            </div>
            <span className="absolute bottom-3 right-3 text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-[1]">
              {currentPhoto + 1}/{photos.length}
            </span>
          </>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">
            <span className="text-sm font-normal text-gray-400">CHF </span>
            {formatCHF(listing.price).replace('CHF ', '')}{listing.context === 'rent' ? '/mois' : ''}
          </span>
          {listing.price_per_m2 && listing.price_per_m2 > 0 && listing.surface_m2 > 0 && (
            <span className="text-[11px] text-gray-400">
              CHF {Math.round(listing.price_per_m2).toLocaleString('fr-CH')}/m²
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 truncate">
          {listing.address}, {listing.city}
        </p>
        <div className="flex items-center text-[13px] text-gray-500 mt-2 gap-1">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
              {listing.rooms} pièces
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-300 mx-0.5">·</span>
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-400" />
                {listing.bedrooms} ch.
              </span>
            </>
          )}
          <span className="text-gray-300 mx-0.5">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5 text-gray-400" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
        {listing.description && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-1">{listing.description}</p>
        )}
        {(listing.agency_name || listing.days_on_market !== undefined) && (
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
            {listing.agency_name && (
              <span className="text-[11px] text-gray-400 truncate max-w-[60%]">{listing.agency_name}</span>
            )}
            {listing.days_on_market !== undefined && (
              <span className="text-[11px] text-gray-400">
                {listing.days_on_market <= 1 ? "Aujourd'hui" : listing.days_on_market <= 7 ? `il y a ${listing.days_on_market}j` : `${listing.days_on_market}j`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
