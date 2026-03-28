import { Link } from 'react-router-dom'
import { Heart, ArrowRight, Clock } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface RecentListing {
  id: string
  title: string
  price: number
  address: string
  rooms: number
  bedrooms: number
  surface: number
  imageUrl: string
  timeAgo: string
  isRental?: boolean
  priceLabel?: string
}

const RECENT: RecentListing[] = [
  {
    id: 'r1',
    title: 'Duplex avec terrasse Carouge',
    price: 1120000,
    address: 'Rue Ancienne 34, 1227 Carouge',
    rooms: 5,
    bedrooms: 3,
    surface: 135,
    imageUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    timeAgo: 'il y a 2h',
  },
  {
    id: 'r2',
    title: 'Studio meublé Pâquis',
    price: 1850,
    address: 'Rue de Berne 12, 1201 Genève',
    rooms: 1,
    bedrooms: 1,
    surface: 32,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    timeAgo: 'il y a 5h',
    isRental: true,
    priceLabel: '/mois',
  },
  {
    id: 'r3',
    title: 'Maison familiale Meyrin',
    price: 1680000,
    address: 'Chemin des Bossons 7, 1217 Meyrin',
    rooms: 6,
    bedrooms: 4,
    surface: 190,
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    timeAgo: 'il y a 8h',
  },
  {
    id: 'r4',
    title: 'Appartement rénové Servette',
    price: 795000,
    address: 'Rue de la Servette 88, 1202 Genève',
    rooms: 3,
    bedrooms: 1,
    surface: 68,
    imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    timeAgo: 'il y a 12h',
  },
  {
    id: 'r5',
    title: 'Attique vue Salève',
    price: 2150000,
    address: 'Route de Florissant 50, 1206 Genève',
    rooms: 5,
    bedrooms: 3,
    surface: 145,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    timeAgo: 'il y a 1 jour',
  },
  {
    id: 'r6',
    title: '3 pièces lumineux Plainpalais',
    price: 2200,
    address: 'Boulevard Carl-Vogt 20, 1205 Genève',
    rooms: 3,
    bedrooms: 1,
    surface: 72,
    imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    timeAgo: 'il y a 1 jour',
    isRental: true,
    priceLabel: '/mois',
  },
  {
    id: 'r7',
    title: 'Villa avec piscine Vandoeuvres',
    price: 4500000,
    address: 'Chemin de la Tourelle 3, 1253 Vandoeuvres',
    rooms: 8,
    bedrooms: 5,
    surface: 320,
    imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    timeAgo: 'il y a 2 jours',
  },
  {
    id: 'r8',
    title: 'Appartement traversant Eaux-Vives',
    price: 980000,
    address: 'Rue du Lac 15, 1207 Genève',
    rooms: 4,
    bedrooms: 2,
    surface: 92,
    imageUrl: 'https://images.unsplash.com/photo-1600566753086-00f18f6b5e29?w=800&q=80',
    timeAgo: 'il y a 2 jours',
  },
]

export default function RecentListings() {
  return (
    <section className="py-12 md:py-16 bg-[var(--color-bg-section,#F9FAFB)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-primary">
              Dernières annonces
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Publiées récemment sur MEGGA
            </p>
          </div>
          <Link
            to="/acheter"
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors group"
          >
            Voir toutes les annonces
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {RECENT.map((listing) => (
            <Link
              key={listing.id}
              to={`/listing/${listing.id}`}
              className="group bg-white rounded-card overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                {/* Favorite */}
                <button
                  onClick={(e) => e.preventDefault()}
                  className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <Heart className="w-4 h-4 text-gray-500" />
                </button>
                {/* Badge nouveau */}
                <span className="absolute top-2.5 left-2.5 bg-accent text-white text-[10px] font-semibold px-2 py-0.5 rounded-badge uppercase tracking-wide">
                  Nouveau
                </span>
                {/* Time ago */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Clock className="w-2.5 h-2.5 text-white/70" />
                  <span className="text-[10px] text-white/80 font-medium">
                    {listing.timeAgo}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 md:p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base md:text-lg font-bold text-primary">
                    {formatCHF(listing.price)}
                  </span>
                  {listing.priceLabel && (
                    <span className="text-xs text-gray-400">
                      {listing.priceLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">
                  {listing.address}
                </p>
                <p className="text-[11px] md:text-xs text-gray-400 mt-1.5">
                  {listing.rooms} pièces · {listing.bedrooms} ch · {listing.surface} m²
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center md:hidden">
          <Link
            to="/acheter"
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium text-accent',
              'hover:text-accent/80 transition-colors'
            )}
          >
            Voir toutes les annonces
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
