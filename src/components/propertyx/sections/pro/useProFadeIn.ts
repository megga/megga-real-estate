import { useEffect, useRef, type RefObject } from 'react'
import { PX } from '../../tokens'

export function useProFadeIn<T extends HTMLElement>(delayMs = 0): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.style.opacity = '0'
    el.style.transform = 'translateY(24px)'
    el.style.transition = `opacity 700ms ${PX.ease}, transform 700ms ${PX.ease}`
    el.style.transitionDelay = `${delayMs}ms`

    const reveal = () => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }

    // Fallback : tout doit être révélé au plus tard après 1.2s,
    // même si l'IntersectionObserver ne s'est pas déclenché (ex : screenshot
    // full-page, prefers-reduced-motion, viewport instable).
    const fallback = window.setTimeout(reveal, 1200)

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      window.clearTimeout(fallback)
      reveal()
      return
    }

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            window.clearTimeout(fallback)
            reveal()
            obs.disconnect()
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px 10% 0px' }
    )

    obs.observe(el)
    return () => {
      window.clearTimeout(fallback)
      obs.disconnect()
    }
  }, [delayMs])

  return ref
}
