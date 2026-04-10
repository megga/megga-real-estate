import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listings: ListingCardData[]
  favoriteIds: string[]
  onBack: () => void
  onPreview: (id: string) => void
}

export default function FavoritesPanel({ listings, favoriteIds, onBack, onPreview }: Props) {
  const { t } = useTranslation('common')
  const favorites = listings.filter(l => favoriteIds.includes(l.id))

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
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <img src="/illustrations/maggy/Like.svg" alt="" className="w-44 h-36 mx-auto mb-3" loading="lazy" decoding="async" />
            <p className="text-sm font-medium text-gray-700 mb-1">{t('search.noFavorites')}</p>
            <p className="text-xs text-gray-500 max-w-[200px]">
              {t('search.noFavoritesDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map(listing => (
              <button
                key={listing.id}
                onClick={() => onPreview(listing.id)}
                className="w-full flex gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
              >
                {/* Photo */}
                <div className="w-20 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {listing.photos?.[0] ? (
                    <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{formatCHF(listing.price)}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{listing.address || listing.city}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {listing.rooms ? `${listing.rooms}p` : ''}
                    {listing.surface_m2 ? ` · ${listing.surface_m2} m²` : ''}
                    {listing.canton ? ` · ${listing.canton}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
