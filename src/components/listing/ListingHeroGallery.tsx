import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Images, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListingHeroGalleryProps {
  photos: string[]
  title: string
  onOpenLightbox: (index: number) => void
}

export default function ListingHeroGallery({ photos, title, onOpenLightbox }: ListingHeroGalleryProps) {
  const [heroIndex, setHeroIndex] = useState(0)
  const [mobileIndex, setMobileIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const photoCount = photos.length
  const hasPhotos = photoCount > 0

  if (!hasPhotos) {
    return (
      <div className="w-full h-[40vh] bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune photo disponible</p>
        </div>
      </div>
    )
  }

  const photo2 = photos[1] || photos[0]
  const photo3 = photos[2] || photos[0]

  return (
    <>
      {/* ── Desktop: cinematic grid ── */}
      <section className="hidden md:block w-full">
        <div className="grid grid-cols-5 grid-rows-2 gap-1.5 h-[65vh] max-h-[600px]">
          {/* Main photo (60%) */}
          <div
            className="col-span-3 row-span-2 relative overflow-hidden group cursor-pointer"
            onClick={() => onOpenLightbox(heroIndex)}
          >
            <img
              src={photos[heroIndex]}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            {/* Counter */}
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
              {heroIndex + 1}/{photoCount}
            </div>
            {/* Navigation arrows on main photo */}
            {heroIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setHeroIndex(heroIndex - 1) }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <ChevronLeft className="h-5 w-5 text-gray-800" />
              </button>
            )}
            {heroIndex < photoCount - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setHeroIndex(heroIndex + 1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <ChevronRight className="h-5 w-5 text-gray-800" />
              </button>
            )}
          </div>

          {/* Top-right photo */}
          <button
            className="col-span-2 row-span-1 relative overflow-hidden group"
            onClick={() => onOpenLightbox(1)}
          >
            <img
              src={photo2}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          </button>

          {/* Bottom-right photo */}
          <div
            className="col-span-2 row-span-1 relative overflow-hidden group cursor-pointer"
            onClick={() => onOpenLightbox(2)}
          >
            <img
              src={photo3}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            {/* "See all photos" overlay */}
            <div className="absolute bottom-4 right-4">
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLightbox(0) }}
                className="bg-white/90 backdrop-blur-sm text-gray-900 text-sm font-medium px-4 py-2 rounded-lg shadow-sm hover:bg-white transition-colors flex items-center gap-2"
              >
                <Images className="h-4 w-4" />
                Voir les {photoCount} photos
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile: horizontal carousel ── */}
      <section className="md:hidden relative">
        <div
          ref={carouselRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none h-[50vh]"
          onScroll={(e) => {
            const el = e.currentTarget
            const idx = Math.round(el.scrollLeft / el.offsetWidth)
            setMobileIndex(idx)
          }}
        >
          {photos.map((photo, i) => (
            <div key={i} className="w-full flex-shrink-0 snap-center">
              <img
                src={photo}
                alt={i === 0 ? title : ''}
                className="w-full h-full object-cover"
                onClick={() => onOpenLightbox(i)}
                loading={i > 2 ? 'lazy' : undefined}
                decoding="async"
              />
            </div>
          ))}
        </div>
        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.slice(0, 7).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                mobileIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
              )}
            />
          ))}
          {photoCount > 7 && <div className="w-1.5 h-1.5 rounded-full bg-white/40" />}
        </div>
        {/* Counter */}
        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
          {mobileIndex + 1}/{photoCount}
        </div>
      </section>
    </>
  )
}
