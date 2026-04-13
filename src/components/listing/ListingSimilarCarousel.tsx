import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { formatCHF, formatSurface } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface ListingSimilarCarouselProps {
  listings: ListingCardData[]
}

export default function ListingSimilarCarousel({ listings }: ListingSimilarCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (listings.length === 0) return null

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = 340
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  return (
    <div id="similaires" className="scroll-mt-28 py-12 mb-20 lg:mb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Biens similaires</h2>
      </div>

      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 px-4 md:px-[calc((100vw-1152px)/2+24px)]"
        >
          {listings.map((sl) => {
            const photo = sl.photos?.[0]
            return (
              <Link
                key={sl.id}
                to={`/listing/${sl.id}`}
                className="min-w-[280px] md:min-w-[320px] snap-start bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow group flex-shrink-0"
              >
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  {photo ? (
                    <img
                      src={optimizeImageUrl(photo, IMAGE_PRESETS.card)}
                      alt={sl.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-lg font-semibold text-gray-900">
                    <span className="text-sm font-normal text-gray-500">CHF </span>
                    {formatCHF(sl.price).replace('CHF ', '')}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{sl.address}, {sl.city}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1.5">
                    {sl.rooms > 0 && <span>{sl.rooms} pièces</span>}
                    {sl.rooms > 0 && sl.surface_m2 > 0 && <span className="text-gray-500">·</span>}
                    {sl.surface_m2 > 0 && <span>{formatSurface(sl.surface_m2)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Navigation arrows (desktop only, if > 3 items) */}
        {listings.length > 3 && (
          <>
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/90 shadow-md rounded-full items-center justify-center hover:bg-white transition-colors z-10"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/90 shadow-md rounded-full items-center justify-center hover:bg-white transition-colors z-10"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
