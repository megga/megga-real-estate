import { useEffect, useState } from 'react'

/**
 * Reads the user's `prefers-reduced-motion` setting and stays subscribed to
 * changes. Animation primitives in the app gate themselves on this hook so
 * that motion-sensitive users (vestibular disorders, attention conditions)
 * get instant transitions instead of springs.
 *
 * Usage:
 *   const reducedMotion = useReducedMotion()
 *   const transition = reducedMotion ? { duration: 0 } : { type: 'spring', ... }
 *
 * SSR-safe: returns `false` on the server, then re-evaluates on mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    // Modern Safari needs addEventListener; older Safari < 14 needs addListener.
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    mq.addListener(handler)
    return () => mq.removeListener(handler)
  }, [])

  return reduced
}
