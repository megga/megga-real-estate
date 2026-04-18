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
        'block bg-white rounded-2xl transition-all duration-300 overflow-hidden group cursor-pointer',
        isHovered
          ? 'shadow-[0_18px_36px_-14px_rgba(15,23,42,0.2),0_4px_10px_-3px_rgba(15,23,42,0.08)] -translate-y-0.5'
          : 'shadow-[0_10px_24px_-12px_rgba(15,23,42,0.12),0_2px_6px_-2px_rgba(15,23,42,0.05)] hover:shadow-[0_18px_36px_-14px_rgba(15,23,42,0.18)] hover:-translate-y-0.5'
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
              'absolute top-3 left-3 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md shadow-[0_2px_6px_-2px_rgba(15,23,42,0.25)]'
            )}
          >
            {badge.label}
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.() }}
            aria-label={isFav ? t('search.removeFromFavorites') : t('search.addToFavorites')}
            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-md hover:bg-white shadow-[0_2px_6px_-2px_rgba(15,23,42,0.2)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Heart className={cn('h-4 w-4 transition-colors', isFav ? 'fill-red-500 text-red-500' : 'text-gray-700')} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCompare?.() }}
            aria-label={isCompared ? t('search.removeFromCompare') : t('search.compare')}
            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-md hover:bg-white shadow-[0_2px_6px_-2px_rgba(15,23,42,0.2)] flex items-center justify-center cursor-pointer transition-colors"
          >
            {isCompared ? <Check className="h-4 w-4 text-accent" strokeWidth={2.25} /> : <GitCompareArrows className="h-3.5 w-3.5 text-gray-700" strokeWidth={2} />}
          </button>
        </div>
        {(isFav || isCompared) && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 group-hover:hidden">
            {isFav && (
              <div className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-md shadow-[0_2px_6px_-2px_rgba(15,23,42,0.2)] flex items-center justify-center">
                <Heart className="h-4 w-4 fill-red-500 text-red-500" strokeWidth={2} />
              </div>
            )}
            {isCompared && (
              <div className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-md shadow-[0_2px_6px_-2px_rgba(15,23,42,0.2)] flex items-center justify-center">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.25} />
              </div>
            )}
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
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[17px] font-semibold text-gray-900 tabular-nums tracking-tight">
              <span className="text-xs font-medium text-gray-400 mr-0.5">CHF</span>
              {formatCHF(listing.price).replace('CHF ', '')}{listing.context === 'rent' ? t('search.perMonth') : ''}
            </span>
            {listing.context !== 'rent' && listing.price_per_m2 && listing.price_per_m2 > 0 && listing.surface_m2 > 0 && (
              <span className="text-xs text-gray-400 tabular-nums">
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
        <p className="text-[13px] text-gray-500 mt-1 truncate">
          {listing.address}, {listing.city}
        </p>
        <div className="flex items-center text-[13px] text-gray-600 mt-2 gap-2">
          {listing.rooms > 0 && (
            <span className="flex items-center gap-1.5">
              <DoorOpen className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.75} />
              {listing.rooms} {t('search.rooms')}
            </span>
          )}
          {listing.bedrooms > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.75} />
                {listing.bedrooms} {t('search.bedrooms')}
              </span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5">
            <Maximize className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.75} />
            {formatSurface(listing.surface_m2)}
          </span>
          {listing.context === 'rent' && listing.is_furnished && (
            <>
              <span className="text-gray-300">·</span>
              <span>{t('rental.badgeFurnished', 'Meublé')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
