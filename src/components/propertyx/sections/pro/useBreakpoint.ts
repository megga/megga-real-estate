// MEGGA Pro — Hook breakpoint pour responsive cohérent sur toutes les sections.
//
// Breakpoints alignés Tailwind :
// - mobile  : < 768px   (smartphones portrait + landscape)
// - tablet  : 768-1023px (iPad portrait, petits desktops)
// - desktop : >= 1024px

import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function useBreakpoint(): Breakpoint {
  // SSR-safe : default desktop côté serveur, ajusté au mount côté client.
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop'
    return getBreakpoint(window.innerWidth)
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    let frame: number | null = null
    const update = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setBp(getBreakpoint(window.innerWidth))
      })
    }
    window.addEventListener('resize', update)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
    }
  }, [])

  return bp
}

// Helpers fréquents
export function isMobile(bp: Breakpoint): boolean {
  return bp === 'mobile'
}

export function isTabletOrMobile(bp: Breakpoint): boolean {
  return bp === 'mobile' || bp === 'tablet'
}

export function isDesktop(bp: Breakpoint): boolean {
  return bp === 'desktop'
}
