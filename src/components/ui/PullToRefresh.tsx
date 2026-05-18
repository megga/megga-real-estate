import { useCallback, useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { Loader2, ArrowDown } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * `<PullToRefresh>` is the iOS-style elastic-drag refresh indicator. Wrap a
 * scrollable region; the component absorbs the over-scroll-at-top gesture
 * and reveals a spinner that resists drag (rubber-band), then triggers
 * `onRefresh` past the threshold.
 *
 * Behaviour:
 *   - Activates ONLY when the wrapper's scrollTop is 0 at drag start
 *     (otherwise it's a normal scroll, no PTR).
 *   - Drag distance is dampened to ~50% so the user feels resistance.
 *   - Past `triggerDistance` (default 80 px) at release, fires `onRefresh()`.
 *   - While `isRefreshing`, the indicator sticks at trigger distance until
 *     the consumer flips the flag back.
 *   - Reduced-motion: no drag, no animation. The trigger is still wired via
 *     a fallback "Actualiser" button rendered on top.
 *
 * Performance:
 *   - Uses framer-motion's `useMotionValue` to bypass React re-renders during
 *     drag — pure GPU transforms.
 *   - Touch-only by default (mobile-first). Desktop renders a fallback btn
 *     so the gesture isn't strictly required.
 */

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void> | void
  /** Visual reset distance (px). Default 80. */
  triggerDistance?: number
  /** Maximum drag distance after damping. Default 120. */
  maxDistance?: number
  className?: string
  /** Render a fallback "Actualiser" button when reduced-motion is on. */
  reducedMotionFallback?: ReactNode
}

const PTR_SPRING = { type: 'spring' as const, stiffness: 360, damping: 32 }

export default function PullToRefresh({
  children,
  onRefresh,
  triggerDistance = 80,
  maxDistance = 120,
  className,
  reducedMotionFallback,
}: PullToRefreshProps) {
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const pullY = useMotionValue(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)

  const iconRotation = useTransform(pullY, [0, triggerDistance], [0, 180])
  const iconOpacity = useTransform(pullY, [0, triggerDistance * 0.4], [0, 1])

  const finishRefresh = useCallback(async () => {
    setIsRefreshing(true)
    pullY.set(triggerDistance)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
      pullY.set(0)
    }
  }, [onRefresh, pullY, triggerDistance])

  function onTouchStart(e: React.TouchEvent) {
    if (reducedMotion || isRefreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    dragging.current = true
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      pullY.set(0)
      return
    }
    // Rubber-band: half the actual delta, hard-capped at maxDistance.
    const dampened = Math.min(delta * 0.5, maxDistance)
    pullY.set(dampened)
  }

  function onTouchEnd() {
    if (!dragging.current) return
    dragging.current = false
    startY.current = null
    if (pullY.get() >= triggerDistance) {
      void finishRefresh()
    } else {
      pullY.set(0)
    }
  }

  if (reducedMotion) {
    return (
      <div ref={containerRef} className={className}>
        {reducedMotionFallback ?? (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={() => void finishRefresh()}
              disabled={isRefreshing}
              className="text-xs font-medium text-theme-secondary px-3 py-1.5 rounded-full border border-theme-border"
            >
              {isRefreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        )}
        {children}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className={className}
      style={{ overscrollBehaviorY: 'contain' }}
    >
      {/* Refresh indicator — absolutely positioned above content, follows pullY. */}
      <motion.div
        style={{
          y: pullY,
          height: triggerDistance,
          marginTop: -triggerDistance,
          opacity: iconOpacity,
        }}
        transition={isRefreshing ? PTR_SPRING : { duration: 0 }}
        className="flex items-center justify-center text-theme-secondary"
        aria-live="polite"
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <motion.div style={{ rotate: iconRotation }}>
            <ArrowDown className="h-5 w-5" />
          </motion.div>
        )}
      </motion.div>

      <motion.div style={{ y: pullY }} transition={isRefreshing ? PTR_SPRING : { duration: 0 }}>
        {children}
      </motion.div>
    </div>
  )
}
