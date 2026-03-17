import { MapPin } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface MapMarker {
  id: string
  lat: number
  lng: number
  price: number
  label: string
}

interface MapViewProps {
  markers: MapMarker[]
  className?: string
  selectedId?: string
  onMarkerClick?: (id: string) => void
}

export default function MapView({ markers, className, selectedId, onMarkerClick }: MapViewProps) {
  return (
    <div className={cn('relative bg-section rounded-card overflow-hidden', className)} role="img" aria-label={`Carte avec ${markers.length} biens immobiliers`}>
      {/* Placeholder map background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-light to-section" aria-hidden="true">
        {/* Grid pattern to simulate map */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Simulated water body (lac Léman) */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-accent/10 rounded-t-[100px]" />
      </div>

      {/* Map markers */}
      <div className="relative h-full">
        {markers.map((marker, i) => {
          const isSelected = selectedId === marker.id
          // Distribute markers across the map area
          const positions = [
            { top: '20%', left: '30%' },
            { top: '35%', left: '55%' },
            { top: '15%', left: '70%' },
            { top: '50%', left: '25%' },
            { top: '45%', left: '65%' },
            { top: '60%', left: '45%' },
          ]
          const pos = positions[i % positions.length]

          return (
            <button
              key={marker.id}
              className={cn(
                'absolute transform -translate-x-1/2 -translate-y-full transition-all z-10 hover:z-20',
                isSelected && 'z-20'
              )}
              style={{ top: pos.top, left: pos.left }}
              onClick={() => onMarkerClick?.(marker.id)}
              aria-label={`${marker.label} — ${formatCHF(marker.price)}`}
              aria-pressed={isSelected}
            >
              {/* Price pill */}
              <div
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-bold shadow-card whitespace-nowrap transition-colors',
                  isSelected
                    ? 'bg-accent text-white scale-110'
                    : 'bg-white text-primary-900 hover:bg-accent hover:text-white'
                )}
              >
                {formatCHF(marker.price)}
              </div>
              {/* Pin */}
              <div className="flex justify-center -mt-0.5" aria-hidden="true">
                <div
                  className={cn(
                    'w-2 h-2 rotate-45 transition-colors',
                    isSelected ? 'bg-accent' : 'bg-white'
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Map controls placeholder */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          className="h-8 w-8 bg-white rounded-button shadow-card flex items-center justify-center text-primary-600 hover:text-primary-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          className="h-8 w-8 bg-white rounded-button shadow-card flex items-center justify-center text-primary-600 hover:text-primary-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          aria-label="Zoom arrière"
        >
          −
        </button>
      </div>

      {/* Attribution placeholder */}
      <div className="absolute bottom-2 right-2 text-[10px] text-primary-400 bg-white/80 px-1.5 py-0.5 rounded">
        <MapPin className="h-2.5 w-2.5 inline mr-0.5" aria-hidden="true" />
        Carte — Mapbox (bientôt)
      </div>
    </div>
  )
}
