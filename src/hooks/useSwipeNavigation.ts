import { useRef, useCallback } from 'react'

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  threshold?: number
  enabled?: boolean
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: UseSwipeNavigationOptions) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return
    const touch = e.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [enabled])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !startRef.current || e.changedTouches.length !== 1) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startRef.current.x
    const dy = touch.clientY - startRef.current.y
    const elapsed = Date.now() - startRef.current.time
    startRef.current = null

    if (elapsed > 400) return
    if (Math.abs(dx) < threshold) return
    if (Math.abs(dx) < Math.abs(dy)) return

    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
  }, [enabled, threshold, onSwipeLeft, onSwipeRight])

  return { onTouchStart, onTouchEnd }
}
