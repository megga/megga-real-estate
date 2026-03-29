import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface BeforeAfterSliderProps {
  before: string
  after: string
  className?: string
  beforeLabel?: string
  afterLabel?: string
}

export default function BeforeAfterSlider({
  before,
  after,
  className,
  beforeLabel = 'Original',
  afterLabel = 'Meublé',
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    setContainerWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updatePosition(e.clientX)
  }, [updatePosition])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) updatePosition(e.clientX)
  }, [updatePosition])

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden select-none cursor-col-resize', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="slider"
      aria-label="Comparer avant et après"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      style={{ touchAction: 'none' }}
    >
      {/* After image (full background) */}
      <img
        src={after}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 h-full object-contain"
          style={{ width: containerWidth > 0 ? `${containerWidth}px` : '100%', maxWidth: 'none' }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-0.5 h-full bg-white shadow-lg" />
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-gray-600" />
            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-600" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
        {beforeLabel}
      </div>
      <div className="absolute bottom-4 right-4 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
        {afterLabel}
      </div>

      {/* Invisible full-size container for sizing */}
      <img
        src={before}
        alt=""
        className="invisible w-full h-full object-contain"
        draggable={false}
      />
    </div>
  )
}
