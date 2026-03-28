import { MapPin, DoorOpen, BedDouble, Bath, Maximize, Building2 } from 'lucide-react'
import { cn, formatSurface } from '@/lib/utils'

interface ListingHeaderProps {
  listing: {
    title: string
    address: string
    city: string
    canton: string
    postal_code: string
    rooms: number
    bedrooms: number
    bathrooms: number
    surface_m2: number
    floor: number
    is_hot?: boolean
    is_new?: boolean
    is_exclusive?: boolean
  }
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'hot' | 'new' | 'exclusive' | 'default' }) {
  const styles = {
    hot: 'bg-red-500 text-white',
    new: 'bg-accent text-white',
    exclusive: 'bg-gray-900 text-white',
    default: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-md inline-flex items-center gap-1', styles[variant])}>
      {children}
    </span>
  )
}

const STATS = [
  { key: 'rooms', icon: DoorOpen, label: 'Pièces' },
  { key: 'bedrooms', icon: BedDouble, label: 'Chambres' },
  { key: 'bathrooms', icon: Bath, label: 'Salle de bain', pluralLabel: 'Salles de bain' },
  { key: 'surface_m2', icon: Maximize, label: 'Surface', format: true },
  { key: 'floor', icon: Building2, label: 'Étage', suffix: 'e' },
] as const

export default function ListingHeader({ listing }: ListingHeaderProps) {
  return (
    <div id="description" className="scroll-mt-28">
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {listing.is_hot && <Badge variant="hot">Hot price</Badge>}
        {listing.is_new && <Badge variant="new">Nouveau</Badge>}
        {listing.is_exclusive && <Badge variant="exclusive">Exclusif</Badge>}
      </div>

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
        {listing.title}
      </h1>

      {/* Address */}
      <div className="flex items-center gap-1.5 text-gray-500">
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">
          {listing.address}, {listing.postal_code} {listing.city} ({listing.canton})
        </span>
      </div>

      {/* Key stats */}
      <div className="flex flex-wrap items-center gap-6 mt-5 py-5 border-y border-gray-100">
        {STATS.map(({ key, icon: Icon, label, pluralLabel, format, suffix }) => {
          const value = listing[key as keyof typeof listing] as number
          if (!value || value === 0) return null
          return (
            <div key={key} className="flex items-center gap-2.5">
              <Icon className="h-6 w-6 text-accent" />
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {format ? formatSurface(value) : `${value}${suffix || ''}`}
                </p>
                <p className="text-xs text-gray-500">
                  {pluralLabel && value > 1 ? pluralLabel : label}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
