import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Clock } from 'lucide-react'
import { formatCHF } from '@/lib/utils'

interface RecentListing {
  id: string
  price: number
  address: string
  rooms: number
  surface: number
  imageUrl: string
  timeAgo: string
  isRental?: boolean
  priceLabel?: string
}

const RECENT: RecentListing[] = [
  {
    id: 'r1',
    price: 1120000,
    address: 'Rue Ancienne 34, 1227 Carouge',
    rooms: 5,
    surface: 135,
    imageUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    timeAgo: '2h',
  },
  {
    id: 'r2',
    price: 1850,
    address: 'Rue de Berne 12, 1201 Genève',
    rooms: 1,
    surface: 32,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    timeAgo: '5h',
    isRental: true,
    priceLabel: '/mois',
  },
  {
    id: 'r3',
    price: 1680000,
    address: 'Chemin des Bossons 7, 1217 Meyrin',
    rooms: 6,
    surface: 190,
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    timeAgo: '8h',
  },
  {
    id: 'r4',
    price: 795000,
    address: 'Rue de la Servette 88, 1202 Genève',
    rooms: 3,
    surface: 68,
    imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    timeAgo: '12h',
  },
  {
    id: 'r5',
    price: 2150000,
    address: 'Route de Florissant 50, 1206 Genève',
    rooms: 5,
    surface: 145,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    timeAgo: '1j',
  },
  {
    id: 'r6',
    price: 2200,
    address: 'Boulevard Carl-Vogt 20, 1205 Genève',
    rooms: 3,
    surface: 72,
    imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    timeAgo: '1j',
    isRental: true,
    priceLabel: '/mois',
  },
  {
    id: 'r7',
    price: 4500000,
    address: 'Chemin de la Tourelle 3, 1253 Vandoeuvres',
    rooms: 8,
    surface: 320,
    imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    timeAgo: '2j',
  },
  {
    id: 'r8',
    price: 980000,
    address: 'Rue du Lac 15, 1207 Genève',
    rooms: 4,
    surface: 92,
    imageUrl: 'https://images.unsplash.com/photo-1600566753086-00f18f6b5e29?w=800&q=80',
    timeAgo: '2j',
  },
]

export default function RecentListings() {
  const { t } = useTranslation('common')

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

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {RECENT.map((listing) => (
            <Link
              key={listing.id}
              to={`/acheter?listing=${listing.id}`}
              className="group overflow-hidden rounded-xl"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <img
                  src={listing.imageUrl}
                  alt={listing.address}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {/* Time badge */}
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-white/80">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs font-medium">{listing.timeAgo}</span>
                </div>
              </div>

              {/* Info — compact */}
              <div className="pt-3 pb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-gray-900">
                    {formatCHF(listing.price)}
                  </span>
                  {listing.priceLabel && (
                    <span className="text-xs text-gray-400">{listing.priceLabel}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{listing.address}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {listing.rooms} pièces · {listing.surface} m²
                </p>
              </div>
            </Link>
          ))}
        </div>

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
