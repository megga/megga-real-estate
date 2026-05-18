import { motion, type Transition } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * Page-level enter/exit animation. Plugs into the `<AnimatePresence>` wrapped
 * around `<Routes>` in App.tsx — when the URL changes, the outgoing page
 * runs its `exit`, then the incoming page runs `initial → animate`.
 *
 * Four variants cover the four UX zones of MEGGA:
 *   - "push"      → hierarchical nav (liste → détail). Horizontal slide with
 *                   parallax-like exit. iOS UINavigationController feel.
 *   - "sheet"     → modal-ish full-page (form, wizard, KYC). Slide up from
 *                   bottom, dimmed-glass parent. iOS UIModalPresentation feel.
 *   - "crossfade" → peer-level nav (tab to tab, dashboard panes). Pure opacity.
 *                   Used heavily in the agent CRM where direction has no
 *                   semantic meaning.
 *   - "fade-up"   → the legacy 8px subtle entry. Kept for the admin pages
 *                   already using the previous PageTransition signature.
 *
 * Reduced-motion users get a 0-duration fade so layout still re-flows but
 * nothing animates.
 */
export type PageTransitionVariant = 'push' | 'sheet' | 'crossfade' | 'fade-up'

interface PageTransitionProps {
  children: React.ReactNode
  variant?: PageTransitionVariant
  /** Set on the wrapper. Useful when the route's content needs a min-height
   *  (e.g. dashboard layouts that fill the viewport). */
  className?: string
}

// iOS-derived easing + spring tuning. These values were picked to match the
// perceptible "weight" of UIKit defaults — close enough that the app stops
// feeling web-y on mobile.
const SPRING: Transition = { type: 'spring', stiffness: 380, damping: 40, mass: 0.8 }
const EASE_OUT: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
const EASE_FAST: Transition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }

interface VariantConfig {
  initial: Record<string, number | string>
  animate: Record<string, number | string>
  exit: Record<string, number | string>
  transition: Transition
}

const VARIANTS: Record<PageTransitionVariant, VariantConfig> = {
  push: {
    initial:    { x: '8%', opacity: 0 },
    animate:    { x: 0, opacity: 1 },
    exit:       { x: '-4%', opacity: 0 },
    transition: SPRING,
  },
  sheet: {
    initial:    { y: '6%', opacity: 0 },
    animate:    { y: 0, opacity: 1 },
    exit:       { y: '4%', opacity: 0 },
    transition: { type: 'spring', stiffness: 320, damping: 36, mass: 0.9 },
  },
  crossfade: {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    exit:       { opacity: 0 },
    transition: EASE_OUT,
  },
  'fade-up': {
    initial:    { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: -4 },
    transition: EASE_FAST,
  },
}

export default function PageTransition({
  children,
  variant = 'fade-up',
  className,
}: PageTransitionProps) {
  const reducedMotion = useReducedMotion()
  const config = VARIANTS[variant]

  // Reduced-motion: skip the motion props entirely so the page mounts with
  // its natural layout. We still render through `motion.div` so AnimatePresence
  // can track its lifecycle (otherwise exit detection fails).
  if (reducedMotion) {
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0 }}
        className={className}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={config.transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}
