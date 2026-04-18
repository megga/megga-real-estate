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

// Monochrome-first categories. The icon is the only visual signal; we keep
// type (light vs bold stroke) consistent with the rest of the premium
// design language. No tinted badges — that clashed with the Apple/Linear
// minimalism used everywhere else in the preview panel.
const CATEGORY_CONFIG: Record<PoiCategory, { icon: typeof Train; label: string }> = {
  transport: { icon: Train, label: 'Transports' },
  commerce: { icon: ShoppingBag, label: 'Commerces' },
  ecole: { icon: GraduationCap, label: 'Écoles' },
  sante: { icon: HeartPulse, label: 'Santé' },
  loisir: { icon: Coffee, label: 'Loisirs' },
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
        Le quartier
      </p>

      {/* AI Summary */}
      {(summaryLoading || aiSummary) && (
        <div className="mb-5 px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-100">
          {summaryLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 bg-gray-200/70 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-gray-200/70 rounded animate-pulse" />
            </div>
          ) : aiSummary ? (
            <div className="flex gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-gray-900 shrink-0 mt-1" strokeWidth={2} />
              <p className="text-[13px] text-gray-700 leading-relaxed">{aiSummary}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[92px] bg-gray-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Category grid */}
      {!isLoading && hasData && (
        <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')}>
          {(Object.entries(CATEGORY_CONFIG) as Array<[PoiCategory, typeof CATEGORY_CONFIG[PoiCategory]]>).map(
            ([key, config]) => {
              const cat = categories[key]
              if (cat.count === 0) return null
              const Icon = config.icon

              return (
                <div
                  key={key}
                  className="group px-3.5 py-3 rounded-2xl bg-gray-50 border border-transparent hover:bg-white hover:border-gray-200 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 group-hover:border-gray-200 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-gray-900" strokeWidth={2} />
                    </div>
                    <p className="text-[12px] font-semibold text-gray-900 truncate">{config.label}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5 pl-0.5">
                    <span className="text-[13px] font-semibold text-gray-900 tabular-nums">
                      {cat.count}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {cat.count > 1 ? 'lieux' : 'lieu'}
                    </span>
                  </div>
                  {cat.nearest && (
                    <p className="text-[11px] text-gray-400 tabular-nums pl-0.5">
                      {formatDistance(cat.nearest.distanceM)}
                    </p>
                  )}
                </div>
              )
            }
          )}
        </div>
      )}

      {/* Nearest station callout */}
      {station && (
        <div className="flex items-center gap-3 mt-4 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="h-9 w-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
            <Train className="h-4 w-4 text-gray-900" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-900 truncate">{station.name}</p>
            <p className="text-[11px] text-gray-500 tabular-nums">
              {formatWalkTime(station.distanceM)} · {formatDistance(station.distanceM)}
            </p>
          </div>
        </div>
      )}

      {/* No data state */}
      {!isLoading && !hasData && !station && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-100">
          <MapPin className="h-4 w-4 text-gray-400 shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] text-gray-500">Données du quartier non disponibles pour cette localisation</p>
        </div>
      )}
    </div>
  )
}
