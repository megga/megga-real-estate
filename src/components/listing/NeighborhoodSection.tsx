import { Train, ShoppingBag, GraduationCap, HeartPulse, Coffee, MapPin, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNeighborhood, useNeighborhoodSummary, type PoiCategory } from '@/hooks/useNeighborhood'

interface NeighborhoodSectionProps {
  lat?: number
  lng?: number
  canton?: string
  city?: string
  compact?: boolean
}

const CATEGORY_CONFIG: Record<PoiCategory, { icon: typeof Train; label: string; color: string }> = {
  transport: { icon: Train, label: 'Transports', color: 'text-blue-500 bg-blue-50' },
  commerce: { icon: ShoppingBag, label: 'Commerces', color: 'text-amber-600 bg-amber-50' },
  ecole: { icon: GraduationCap, label: 'Écoles', color: 'text-emerald-600 bg-emerald-50' },
  sante: { icon: HeartPulse, label: 'Santé', color: 'text-red-500 bg-red-50' },
  loisir: { icon: Coffee, label: 'Loisirs', color: 'text-purple-500 bg-purple-50' },
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatWalkTime(meters: number): string {
  const min = Math.round(meters / 80)
  if (min <= 1) return '1 min à pied'
  return `${min} min à pied`
}

export default function NeighborhoodSection({ lat, lng, canton, city, compact }: NeighborhoodSectionProps) {
  const { station, categories, isLoading } = useNeighborhood(lat, lng)
  const { data: aiSummary, isLoading: summaryLoading } = useNeighborhoodSummary(
    lat, lng, canton, city, categories, station
  )

  if (!lat || !lng) return null

  const hasData = Object.values(categories).some(c => c.count > 0)

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Le quartier</h3>

      {/* AI Summary */}
      {(summaryLoading || aiSummary) && (
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-100">
          {summaryLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          ) : aiSummary ? (
            <div className="flex gap-2.5">
              <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Category grid */}
      {!isLoading && hasData && (
        <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')}>
          {(Object.entries(CATEGORY_CONFIG) as Array<[PoiCategory, typeof CATEGORY_CONFIG[PoiCategory]]>).map(
            ([key, config]) => {
              const cat = categories[key]
              if (cat.count === 0) return null
              const Icon = config.icon
              const [textColor, bgColor] = config.color.split(' ')

              return (
                <div
                  key={key}
                  className="flex flex-col items-center text-center p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center mb-2', bgColor)}>
                    <Icon className={cn('h-4.5 w-4.5', textColor)} />
                  </div>
                  <p className="text-xs font-semibold text-gray-900">{config.label}</p>
                  <p className="text-[11px] text-gray-500">{cat.count} lieu{cat.count > 1 ? 'x' : ''}</p>
                  {cat.nearest && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatDistance(cat.nearest.distanceM)}</p>
                  )}
                </div>
              )
            }
          )}
        </div>
      )}

      {/* Nearest station callout */}
      {station && (
        <div className="flex items-center gap-2.5 mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Train className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{station.name}</p>
            <p className="text-xs text-gray-500">{formatWalkTime(station.distanceM)} · {formatDistance(station.distanceM)}</p>
          </div>
        </div>
      )}

      {/* No data state */}
      {!isLoading && !hasData && !station && (
        <div className="flex items-center gap-2.5 p-4 bg-gray-50 rounded-lg">
          <MapPin className="h-5 w-5 text-gray-300" />
          <p className="text-sm text-gray-500">Données du quartier non disponibles pour cette localisation</p>
        </div>
      )}
    </div>
  )
}
