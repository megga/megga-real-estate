/** Hooks utilitaires `matchMedia` (responsive) : abonnement réactif à une media query. */
import { useEffect, useState } from 'react'

/** Suit une media query CSS et renvoie son état courant, mis à jour au resize. SSR-safe (false hors navigateur). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    setMatches(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Vrai sous le breakpoint mobile (≤ 768px). */
export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
