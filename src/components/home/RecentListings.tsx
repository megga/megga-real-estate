import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'
import Shimmer from '@/components/ui/Shimmer'
import { StaggerList, StaggerItem } from '@/components/ui/StaggerList'

interface RecentListing {
  id: string
  price: number
  address: string
  rooms: number
  surface_m2: number
  photo: string | null
  publishedAt: string
  transaction_type: 'buy' | 'rent'
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days >= 1) return `${days}j`
  if (hrs >= 1) return `${hrs}h`
  if (mins >= 1) return `${mins}min`
  return 'à l\'instant'
}

function useRecentListings() {
  return useQuery({
    queryKey: ['home-recent-listings'],
    queryFn: async (): Promise<RecentListing[]> => {
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, price, current_price, address, city, postal_code, rooms, surface_m2, photos, first_seen_at, created_at, transaction_type')
        .eq('status', 'active')
        .gte('quality_score', 50)
        .gt('price', 0)
        .not('photos', 'is', null)
        .order('first_seen_at', { ascending: false })
        .limit(8)

      if (error) throw error

      return (data ?? [])
        .filter(d => Array.isArray(d.photos) && d.photos.length > 0)
        .map(d => ({
          id: d.id as string,
          price: Number(d.current_price ?? d.price ?? 0),
          address: [d.address, [d.postal_code, d.city].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ')
            || (d.city as string)
            || '',
          rooms: Number(d.rooms) || 0,
          surface_m2: Number(d.surface_m2) || 0,
          photo: (d.photos as string[])[0] ?? null,
          publishedAt: (d.first_seen_at as string) || (d.created_at as string),
          transaction_type: (d.transaction_type as 'buy' | 'rent') || 'buy',
        }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function RecentListings() {
  const { t } = useTranslation('common')
  const { data: listings, isLoading } = useRecentListings()

  return (
    <section className="py-14 md:py-20 bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t('home.recentListings')}
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              {t('home.recentSubtitle')}
            </p>
          </div>
          <Link
            to="/acheter"
            className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors group"
          >
            {t('home.viewAllListings')}
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Grid — stagger only on populated state. Loading uses static
         *  skeletons so they don't flicker on every re-mount. */}
        <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl">
                  <Shimmer className="aspect-[4/3] rounded-xl" />
                  <div className="pt-3 pb-1 space-y-1.5">
                    <Shimmer className="h-4 w-2/3 rounded" />
                    <Shimmer className="h-3 w-full rounded" />
                    <Shimmer className="h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))
            : (listings ?? []).map((listing) => {
                const route = listing.transaction_type === 'rent' ? 'louer' : 'acheter'
                const timeAgo = formatTimeAgo(listing.publishedAt)
                return (
                  <StaggerItem key={listing.id}>
                  <Link
                    to={`/${route}?listing=market-${listing.id}`}
                    className="group overflow-hidden rounded-xl"
                  >
                    {/* Photo */}
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                      {listing.photo && (
                        <img
                          src={listing.photo}
                          alt={listing.address}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      {timeAgo && (
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-white/80">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-medium">{timeAgo}</span>
                        </div>
                      )}
                    </div>

                    {/* Info — compact */}
                    <div className="pt-3 pb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-gray-900">
                          {formatCHF(listing.price)}
                        </span>
                        {listing.transaction_type === 'rent' && (
                          <span className="text-xs text-gray-400">/mois</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{listing.address}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {listing.rooms > 0 && `${listing.rooms} pièces`}
                        {listing.rooms > 0 && listing.surface_m2 > 0 && ' · '}
                        {listing.surface_m2 > 0 && `${listing.surface_m2} m²`}
                      </p>
                    </div>
                  </Link>
                  </StaggerItem>
                )
              })}
        </StaggerList>

        {/* Mobile CTA */}
        <div className="mt-8 text-center md:hidden">
          <Link
            to="/acheter"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-900"
          >
            {t('home.viewAllListings')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
