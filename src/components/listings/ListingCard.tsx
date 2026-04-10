import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BedDouble, DoorOpen, Maximize, Building2, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'

export interface ListingCardData {
  id: string
  title: string
  price: number
  address: string
  city: string
  rooms: number
  bedrooms: number
  surface_m2: number
  photos: string[]
  is_hot?: boolean
  is_new?: boolean
  is_exclusive?: boolean
  is_3d?: boolean
  type?: string
  context?: 'buy' | 'rent'
  description?: string
  canton?: string
  lifestyle_tags?: string[]
  published_at?: string
  video_url?: string
  agent?: {
    name: string
    agency: string
    phone: string
    email: string
    photo: string
  }
  lat?: number
  lng?: number
  // Market listing extras
  source_portal?: string
  source_url?: string
  agency_name?: string
  price_per_m2?: number
  days_on_market?: number
  price_drop_pct?: number
}

interface ListingCardProps {
  listing: ListingCardData
  className?: string
}

export default function ListingCard({ listing, className }: ListingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const photos = listing.photos?.length ? listing.photos : []

  const handleScroll = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    if (idx !== currentPhoto) setCurrentPhoto(idx)
  }, [currentPhoto])

  const scrollToPhoto = useCallback((idx: number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    carouselRef.current?.scrollTo({ left: idx * (carouselRef.current.offsetWidth), behavior: 'smooth' })
  }, [])

  return (
    <Link to={`/listing/${listing.id}`} className={cn('block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group/card', className)}>
      {/* Photo carousel */}
      <div className="relative aspect-[4/3] overflow-hidden group/photo">
        {photos.length > 0 ? (
          <div
            ref={carouselRef}
            className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            onScroll={handleScroll}
          >
            {photos.map((photo, i) => (
              <div key={i} className="w-full h-full flex-shrink-0 snap-center">
                <img
                  src={photo}
                  alt={i === 0 ? listing.title : ''}
                  className="w-full h-full object-cover"
                  loading={i > 0 ? 'lazy' : undefined}
                  decoding="async"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-500" />
          </div>
        )}

        {/* Navigation arrows (desktop hover) */}
        {photos.length > 1 && (
          <>
            {currentPhoto > 0 && (
              <button
                onClick={(e) => scrollToPhoto(currentPhoto - 1, e)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-4 w-4 text-gray-800" />
              </button>
            )}
            {currentPhoto < photos.length - 1 && (
              <button
                onClick={(e) => scrollToPhoto(currentPhoto + 1, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-4 w-4 text-gray-800" />
              </button>
            )}
          </>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFavorite(!isFavorite) }}
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="absolute top-3 right-3 h-9 w-9 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition-colors z-10"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-danger text-danger' : 'text-primary-600'
            )}
          />
        </button>

        {/* Hot price badge */}
        {listing.is_hot && (
          <div className="absolute top-3 left-3 bg-danger text-white text-xs font-medium px-2 py-0.5 rounded-badge flex items-center gap-1 z-10">
            <span className="text-xs">🔥</span>
            Hot price
          </div>
        )}

        {/* Video indicator badge */}
        {listing.video_url && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 z-10" style={listing.is_hot ? { top: '2.75rem' } : undefined}>
            <Play className="h-3 w-3 fill-white" />
            Vidéo
          </div>
        )}

        {/* Photo dots + counter */}
        {photos.length > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {photos.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => scrollToPhoto(i, e)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    currentPhoto === i
                      ? 'w-4 bg-white'
                      : 'w-1.5 bg-white/60 hover:bg-white/80'
                  )}
                />
              ))}
            </div>
            <span className="absolute bottom-3 right-3 text-xs font-medium text-white bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 z-10">
              {currentPhoto + 1}/{photos.length}
            </span>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-lg font-semibold text-gray-900">
            <span className="text-sm font-normal text-gray-500">CHF </span>
            {formatCHF(listing.price).replace('CHF ', '')}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          {listing.address}, {listing.city}
        </p>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <DoorOpen className="h-3.5 w-3.5" />
            {listing.rooms} pièces
          </span>
          <span className="text-gray-500">·</span>
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {listing.bedrooms} ch.
          </span>
          <span className="text-gray-500">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
      </div>
    </Link>
  )
}
