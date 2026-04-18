import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Heart, Building2, Compass } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { useFavorites } from '@/hooks/useFavorites'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listings: ListingCardData[]
  favoriteIds: string[]
  onBack: () => void
  onPreview: (id: string) => void
}

export default function FavoritesPanel({ listings, favoriteIds, onBack, onPreview }: Props) {
  const { t } = useTranslation('common')
  const { toggleFavorite } = useFavorites()
  const favorites = listings.filter(l => favoriteIds.includes(l.id))

  // Group by city when ≥5 favorites for easier scanning
  const grouped = useMemo(() => {
    if (favorites.length < 5) return null
    const map = new Map<string, ListingCardData[]>()
    for (const f of favorites) {
      const key = f.city || 'Autre'
      const arr = map.get(key) || []
      arr.push(f)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [favorites])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">{t('search.myFavorites')}</h2>
        <span className="text-xs text-gray-500 font-medium">{favorites.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-6 pb-8 px-4">
            <img src="/illustrations/maggy/Like.svg" alt="" className="w-64 h-52 mx-auto mb-5" loading="lazy" decoding="async" />
            <p className="text-base font-semibold text-gray-900 mb-1.5">{t('search.noFavorites')}</p>
            <p className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed mb-6">
              {t('search.noFavoritesDesc')}
            </p>

            {/* Visual tip — mini listing preview with heart pointer */}
            <div className="relative w-full max-w-[260px] mb-6 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.12)]">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-gray-300" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <div className="h-2.5 w-20 bg-gray-200 rounded-full" />
                  <div className="h-2 w-28 bg-gray-100 rounded-full" />
                  <div className="h-2 w-16 bg-gray-100 rounded-full" />
                </div>
              </div>
              {/* Heart icon pulsing in the corner */}
              <div className="absolute -top-2 -right-2 h-9 w-9 rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)] border border-red-100 flex items-center justify-center">
                <Heart className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
              </div>
            </div>
            <p className="text-[12px] text-gray-500 max-w-[260px] leading-relaxed mb-6">
              Clique sur le cœur dans n'importe quelle fiche pour la sauvegarder ici.
            </p>

            {/* Primary CTA */}
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]"
            >
              <Compass className="h-4 w-4" strokeWidth={2} />
              Découvrir des biens
            </button>
          </div>
        ) : (
          <div>
            {grouped ? (
              grouped.map(([city, items]) => (
                <div key={city}>
                  <div className="sticky top-0 z-[1] bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">{city}</span>
                    <span className="text-[11px] font-medium text-gray-400 tabular-nums">{items.length}</span>
                  </div>
                  <div className="px-2 pb-2 space-y-1">
                    {items.map(listing => (
                      <FavoriteRow key={listing.id} listing={listing} onPreview={onPreview} onToggle={toggleFavorite} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-2 space-y-1">
                {favorites.map(listing => (
                  <FavoriteRow key={listing.id} listing={listing} onPreview={onPreview} onToggle={toggleFavorite} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FavoriteRow({
  listing,
  onPreview,
  onToggle,
}: {
  listing: ListingCardData
  onPreview: (id: string) => void
  onToggle: (id: string) => void
}) {
  return (
    <div
      onClick={() => onPreview(listing.id)}
      className="group relative flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
    >
      {/* Square thumbnail */}
      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {listing.photos?.[0] ? (
          <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-5 w-5 text-gray-300" strokeWidth={1.75} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 tabular-nums tracking-tight truncate">
          {formatCHF(listing.price)}{listing.context === 'rent' ? '/m' : ''}
        </p>
        <p className="text-[12px] text-gray-500 truncate mt-0.5">{listing.address || listing.city}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
          {listing.rooms ? `${listing.rooms} p.` : ''}
          {listing.surface_m2 ? `${listing.rooms ? ' · ' : ''}${listing.surface_m2} m²` : ''}
        </p>
      </div>

      {/* Quick unfav — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(listing.id) }}
        aria-label="Retirer des favoris"
        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all cursor-pointer"
      >
        <Heart className="h-4 w-4 fill-red-500 text-red-500" strokeWidth={2} />
      </button>
    </div>
  )
}
