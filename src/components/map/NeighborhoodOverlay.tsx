import { useMemo, useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useNeighborhood, calculateWalkScore, type PoiCategory } from '@/hooks/useNeighborhood'
import { X, Train, ShoppingBag, GraduationCap, HeartPulse, Coffee, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NeighborhoodOverlayProps {
  lat: number
  lng: number
  isMapDark?: boolean
  onClose: () => void
}

const CATEGORY_CONFIG: Record<PoiCategory, { label: string; icon: typeof Train }> = {
  transport: { label: 'Transport', icon: Train },
  commerce: { label: 'Commerces', icon: ShoppingBag },
  ecole: { label: 'Ecoles', icon: GraduationCap },
  sante: { label: 'Sante', icon: HeartPulse },
  loisir: { label: 'Loisirs', icon: Coffee },
}

function ScoreRing({ score, size = 56, isDark }: { score: number; size?: number; isDark: boolean }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444'

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={isDark ? 'white' : '#111827'} strokeOpacity={0.1} strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={isDark ? 'white' : '#111827'} fontSize={16} fontWeight={700}>
        {score}
      </text>
    </svg>
  )
}

function CategoryBar({ label, icon: Icon, score, count, nearest, isDark }: {
  label: string
  icon: typeof Train
  score: number
  count: number
  nearest: string | null
  isDark: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-white/70' : 'text-gray-500')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-[13px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{label}</span>
          <span className={cn('text-xs tabular-nums', isDark ? 'text-white/60' : 'text-gray-500')}>
            {count > 0 ? `${count} lieu${count !== 1 ? 'x' : ''}` : 'Aucun à proximité'}
          </span>
        </div>
        <div className={cn('h-1 rounded-full overflow-hidden', isDark ? 'bg-white/10' : 'bg-gray-900/10')}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(score, count === 0 ? 3 : 0)}%`,
              backgroundColor: count === 0 ? '#9ca3af' : score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444',
            }}
          />
        </div>
        {nearest && (
          <p className={cn('text-xs mt-1 truncate', isDark ? 'text-white/60' : 'text-gray-500')}>{nearest}</p>
        )}
      </div>
    </div>
  )
}

// Walk score label color — returns a hex (not a Tailwind class name) so it
// can be applied via `style.color`.
function scoreLabelHex(score: number): string {
  if (score >= 90) return '#4ade80' // green-400
  if (score >= 70) return '#22c55e' // green-500
  if (score >= 50) return '#facc15' // yellow-400
  if (score >= 25) return '#fb923c' // orange-400
  return '#f87171' // red-400
}

export default function NeighborhoodOverlay({ lat, lng, isMapDark = true, onClose }: NeighborhoodOverlayProps) {
  const isDark = isMapDark
  const { station, categories, isLoading } = useNeighborhood(lat, lng)
  const walkScore = useMemo(
    () => (!isLoading ? calculateWalkScore(categories, station) : null),
    [isLoading, categories, station],
  )

  // Drag — imperative DOM writes via rAF, no React state during the gesture.
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const pendingPos = useRef({ x: 0, y: 0 })
  const dragStart = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null)
  const rafId = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Re-apply current position after every render so React reconciliation
  // (e.g. when useNeighborhood resolves) doesn't reset `transform` on the
  // root div. Without this, the widget jumps back to origin mid-drag.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const cur = dragStart.current ? pendingPos.current : offsetRef.current
    // Before the first drag, let the CSS entry animation own `transform`.
    if (!dragStart.current && cur.x === 0 && cur.y === 0) return
    el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`
  })

  const applyTransform = useCallback(() => {
    rafId.current = null
    const el = containerRef.current
    if (!el) return
    el.style.transform = `translate3d(${pendingPos.current.x}px, ${pendingPos.current.y}px, 0)`
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, offX: offsetRef.current.x, offY: offsetRef.current.y }
    pendingPos.current = { ...offsetRef.current }
    const el = containerRef.current
    if (el) el.style.willChange = 'transform'
    setIsDragging(true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return
    pendingPos.current = {
      x: dragStart.current.offX + (e.clientX - dragStart.current.x),
      y: dragStart.current.offY + (e.clientY - dragStart.current.y),
    }
    if (rafId.current == null) rafId.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    dragStart.current = null
    offsetRef.current = pendingPos.current
    if (rafId.current != null) { cancelAnimationFrame(rafId.current); rafId.current = null }
    const el = containerRef.current
    if (el) el.style.willChange = ''
    setIsDragging(false)
  }, [])

  useEffect(() => () => { if (rafId.current != null) cancelAnimationFrame(rafId.current) }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute top-14 left-4 z-[6] w-72 rounded-xl border animate-in slide-in-from-left-2 duration-300',
        isDark ? 'border-white/10' : 'border-gray-200/70',
        // Drop backdrop-blur and shadow while dragging — they repaint every
        // frame on a moving element and are the main source of stutter.
        isDragging
          ? (isDark ? 'bg-gray-900 shadow-md' : 'bg-white shadow-md')
          : (isDark ? 'bg-gray-900/90 backdrop-blur-xl shadow-2xl' : 'bg-white/90 backdrop-blur-xl shadow-2xl')
      )}
      style={{ contain: 'layout paint' }}
    >
      {/* Header — drag handle */}
      <div
        className="px-4 pt-3 pb-2 flex items-center justify-between cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex items-center gap-2">
          <MapPin className={cn('h-3.5 w-3.5', isDark ? 'text-white/80' : 'text-gray-700')} />
          <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Score quartier</span>
        </div>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn('transition-colors cursor-pointer', isDark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-900')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 flex flex-col items-center gap-2">
          <Loader2 className={cn('h-5 w-5 animate-spin', isDark ? 'text-white/40' : 'text-gray-400')} />
          <span className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-500')}>Analyse du quartier...</span>
        </div>
      ) : walkScore ? (
        <>
          {/* Walk Score ring + label */}
          <div className={cn('px-4 py-3 flex items-center gap-4 border-b', isDark ? 'border-white/10' : 'border-gray-200/70')}>
            <ScoreRing score={walkScore.score} isDark={isDark} />
            <div>
              <p className="text-base font-bold" style={{ color: scoreLabelHex(walkScore.score) }}>{walkScore.label}</p>
              <p className={cn('text-xs mt-0.5', isDark ? 'text-white/60' : 'text-gray-500')}>Walk Score 0-100</p>
              {walkScore.score < 25 && (
                <p className={cn('text-xs mt-1', isDark ? 'text-white/50' : 'text-gray-400')}>Cliquez en centre-ville pour de meilleurs scores</p>
              )}
            </div>
          </div>

          {/* Category breakdowns */}
          <div className="px-4 py-3 flex flex-col gap-2.5">
            {(Object.entries(CATEGORY_CONFIG) as [PoiCategory, typeof CATEGORY_CONFIG[PoiCategory]][]).map(([key, config]) => {
              const cat = categories[key]
              const breakdown = walkScore.breakdown[key] || 0
              return (
                <CategoryBar
                  key={key}
                  label={config.label}
                  icon={config.icon}
                  score={breakdown}
                  count={cat?.count || 0}
                  nearest={cat?.nearest ? `${cat.nearest.name} · ${cat.nearest.distanceM}m` : null}
                  isDark={isDark}
                />
              )
            })}
          </div>

          {/* Nearest station */}
          {station && (
            <div className={cn('px-4 py-3 border-t flex items-center gap-2.5', isDark ? 'border-white/10' : 'border-gray-200/70')}>
              <Train className={cn('h-4 w-4 shrink-0', isDark ? 'text-white/80' : 'text-gray-700')} />
              <div className="min-w-0">
                <p className={cn('text-[13px] font-medium truncate', isDark ? 'text-white' : 'text-gray-900')}>{station.name}</p>
                <p className={cn('text-xs', isDark ? 'text-white/60' : 'text-gray-500')}>{station.formatted}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-400')}>Donnees non disponibles pour ce lieu</p>
        </div>
      )}
    </div>
  )
}
