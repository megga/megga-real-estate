import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getRoomLabel } from '@/types/floorPlan'
import type { FloorPlanHotspot } from '@/types/floorPlan'

interface InteractiveFloorPlanProps {
  floorPlanUrl: string
  hotspots: FloorPlanHotspot[]
  onRoomClick: (roomKey: string, photoUrls: string[]) => void
  activeRoom?: string | null
}

export default function InteractiveFloorPlan({
  floorPlanUrl,
  hotspots,
  onRoomClick,
  activeRoom,
}: InteractiveFloorPlanProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {/* Plan with hotspots */}
      <div
        className="relative rounded-lg overflow-hidden border border-theme-border"
        style={{ touchAction: 'pinch-zoom' }}
      >
        <img
          src={floorPlanUrl}
          alt="Plan d'étage interactif"
          className="w-full h-auto block"
          draggable={false}
          decoding="async"
        />

        {hotspots.map(hs => {
          const isActive = activeRoom === hs.roomKey
          const isHovered = hoveredId === hs.id

          return (
            <div key={hs.id}>
              {/* Hotspot dot */}
              <button
                onClick={() => onRoomClick(hs.roomKey, hs.photoUrls)}
                onMouseEnter={() => setHoveredId(hs.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setFocusedId(hs.id)}
                onBlur={() => setFocusedId(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRoomClick(hs.roomKey, hs.photoUrls)
                  }
                }}
                style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                className={cn(
                  'absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all z-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40',
                  isActive
                    ? 'bg-accent border-white scale-125 ring-2 ring-accent/30'
                    : 'bg-white border-accent hover:bg-accent hover:border-white hover:scale-110'
                )}
                aria-label={`Voir ${getRoomLabel(hs.roomKey)} — ${hs.photoUrls.length} photo${hs.photoUrls.length !== 1 ? 's' : ''}`}
              />

              {/* Tooltip on hover/focus */}
              {(isHovered || isActive || focusedId === hs.id) && (
                <div
                  style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-full -mt-2 bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-20"
                >
                  {getRoomLabel(hs.roomKey)}
                  {hs.photoUrls.length > 0 && (
                    <span className="text-gray-500 ml-1">· {hs.photoUrls.length} photo{hs.photoUrls.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Room pills */}
      {hotspots.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onRoomClick('', [])}
            className={cn(
              'h-7 px-2.5 rounded-md text-xs transition-colors',
              !activeRoom ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            Toutes les pièces
          </button>
          {hotspots.map(hs => (
            <button
              key={hs.id}
              onClick={() => onRoomClick(hs.roomKey, hs.photoUrls)}
              className={cn(
                'h-7 px-2.5 rounded-md text-xs transition-colors',
                activeRoom === hs.roomKey ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary'
              )}
            >
              {getRoomLabel(hs.roomKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
