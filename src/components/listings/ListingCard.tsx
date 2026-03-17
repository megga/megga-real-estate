import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BedDouble, DoorOpen, Maximize } from 'lucide-react'
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
}

interface ListingCardProps {
  listing: ListingCardData
  className?: string
}

export default function ListingCard({ listing, className }: ListingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentPhoto, setCurrentPhoto] = useState(0)

  return (
    <Link
      to={`/listing/${listing.id}`}
      className={cn(
        'block bg-white rounded-card shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group',
        className
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-card">
        <img
          src={listing.photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFavorite(!isFavorite) }}
          className="absolute top-3 right-3 h-9 w-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-200 shadow-sm"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors duration-200',
              isFavorite ? 'fill-danger text-danger' : 'text-primary-600'
            )}
          />
        </button>

        {/* Hot price badge */}
        {listing.is_hot && (
          <div className="absolute top-3 left-3 bg-danger text-white text-xs font-medium px-2.5 py-1 rounded-badge flex items-center gap-1 shadow-sm">
            Hot price
          </div>
        )}

        {/* Photo dots */}
        {listing.photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {listing.photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentPhoto(i) }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  currentPhoto === i
                    ? 'w-4 bg-white'
                    : 'w-1.5 bg-white/60 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xl font-bold text-primary-900">
            {formatCHF(listing.price)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          {listing.address}, {listing.city}
        </p>

        <div className="flex items-center gap-3 text-sm text-primary-400">
          <span className="flex items-center gap-1">
            <DoorOpen className="h-3.5 w-3.5" />
            {listing.rooms} pièces
          </span>
          <span className="text-primary-200">·</span>
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {listing.bedrooms} ch.
          </span>
          <span className="text-primary-200">·</span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" />
            {formatSurface(listing.surface_m2)}
          </span>
        </div>
      </div>
    </Link>
  )
}
