import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Heart, Building2, GitCompareArrows, Check,
  DoorOpen, BedDouble, Maximize, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import { getSmartBadge } from '@/lib/searchFilters'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface SearchListingCardProps {
  listing: ListingCardData
  onHover?: (id: string | undefined) => void
  isHovered?: boolean
  eager?: boolean
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
  eager = false,
  isFavorite: isFav = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  medianPricePerM2 = 0,
  onPreview,
}: SearchListingCardProps) {
  const { t } = useTranslation('common')
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
      role="button"
      tabIndex={0}
      onClick={() => onPreview?.(listing.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview?.(listing.id) } }}
      className={cn(
        'block bg-white border rounded-lg transition-all duration-200 overflow-hidden group cursor-pointer',
        isHovered
          ? 'border-accent/40 ring-1 ring-accent/20'
          : 'border-gray-100 hover:border-gray-200'
      )}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {photos.length > 0 ? (
          <img
            src={optimizeImageUrl(photos[currentPhoto], IMAGE_PRESETS.card)}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading={eager ? undefined : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : undefined}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-500" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        {badge && (
          <div
            className={cn(
              badge.bg,
              'absolute top-3 left-3 text-white text-xs font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm'
            )}
          >
            {badge.label}
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.() }}
            aria-label={isFav ? t('search.removeFromFavorites') : t('search.addToFavorites')}
            className="cursor-pointer transition-all duration-200 drop-shadow-md"
          >
            <Heart className={cn('h-4 w-4 transition-colors', isFav ? 'fill-red-500 text-red-500' : 'text-white')} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCompare?.() }}
            aria-label={isCompared ? t('search.removeFromCompare') : t('search.compare')}
            className="cursor-pointer transition-all duration-200 drop-shadow-md"
          >
            {isCompared ? <Check className="h-4 w-4 text-accent" /> : <GitCompareArrows className="h-3.5 w-3.5 text-white" />}
          </button>
        </div>
        {(isFav || isCompared) && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 group-hover:hidden">
            {isFav && <Heart className="h-4 w-4 fill-red-500 text-red-500 drop-shadow-md" />}
            {isCompared && <Check className="h-4 w-4 text-accent drop-shadow-md" />}
          </div>
        )}
        {photos.length > 1 && (
          <>
            {currentPhoto > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p - 1) }}
                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer drop-shadow-md"
                aria-label={t('search.previousPhoto')}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
            )}
            {currentPhoto < photos.length - 1 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(p => p + 1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer drop-shadow-md"
                aria-label={t('search.nextPhoto')}
              >
                <ChevronRight className="h-5 w-5 text-white" />
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
          </>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-lg font-bold text-gray-900">
              <span className="text-sm font-normal text-gray-500">CHF </span>
              {formatCHF(listing.price).replace('CHF ', '')}{listing.context === 'rent' ? t('search.perMonth') : ''}
            </span>
            {listing.context !== 'rent' && listing.price_per_m2 && listing.price_per_m2 > 0 && listing.surface_m2 > 0 && (
              <span className="text-xs text-gray-500">
                CHF {Math.round(listing.price_per_m2).toLocaleString('fr-CH')}/m²
              </span>
            )}
          </div>
          {listing.agency_logo_url && (
            <div className="h-10 w-24 flex items-center justify-end shrink-0">
              <img
                src={listing.agency_logo_url}
                alt={listing.agency_name || ''}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {listing.address}, {listing.city}
        </p>
        <div className="flex items-center text-sm text-gray-500 mt-1 gap-1">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
              {listing.rooms} {t('search.rooms')}
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-500 mx-0.5">·</span>
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-gray-500" />
                {listing.bedrooms} {t('search.bedrooms')}
              </span>
            </>
          )}
          <span className="text-gray-500 mx-0.5">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5 text-gray-500" />
            {formatSurface(listing.surface_m2)}
          </span>
          {listing.context === 'rent' && listing.is_furnished && (
            <>
              <span className="text-gray-500 mx-0.5">·</span>
              <span className="text-xs text-gray-500">{t('rental.badgeFurnished', 'Meublé')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
