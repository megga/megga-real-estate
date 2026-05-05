import { DoorOpen, BedDouble, Bath, Maximize, Building2 } from 'lucide-react'
import { cn, formatSurface } from '@/lib/utils'

// Note (refonte proto bien) : ListingHeader rend désormais UNIQUEMENT la
// rangée de stats clés (pièces · chambres · sdb · surface · étage).
// Les chips, le titre et l'adresse sont rendus par BienTitleBar
// (port 1:1 du proto megga-bien-page.jsx) en amont sur la page.

interface ListingHeaderProps {
  listing: {
    rooms: number
    bedrooms: number
    bathrooms: number
    surface_m2: number
    floor: number | null
  }
}

interface StatDef {
  key: string
  icon: typeof DoorOpen
  label: string
  pluralLabel?: string
  format?: boolean
  suffix?: string
}

const STATS: StatDef[] = [
  { key: 'rooms', icon: DoorOpen, label: 'Pièces' },
  { key: 'bedrooms', icon: BedDouble, label: 'Chambres' },
  { key: 'bathrooms', icon: Bath, label: 'Salle de bain', pluralLabel: 'Salles de bain' },
  { key: 'surface_m2', icon: Maximize, label: 'Surface', format: true },
  { key: 'floor', icon: Building2, label: 'Étage', suffix: 'e' },
]

export default function ListingHeader({ listing }: ListingHeaderProps) {
  return (
    <div id="description" className="scroll-mt-28">
      {/* Key stats — chips/titre/adresse rendus par BienTitleBar en amont */}
      <div className="flex flex-wrap items-center gap-6 py-5 border-y border-gray-100">
        {STATS.map(({ key, icon: Icon, label, pluralLabel, format, suffix }) => {
          const value = listing[key as keyof typeof listing] as number
          if (!value || value === 0) return null
          return (
            <div key={key} className={cn('flex items-center gap-2.5')}>
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
