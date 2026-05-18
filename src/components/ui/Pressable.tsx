import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * `<Pressable>` is a button-shaped wrapper that responds to tap/click with a
 * subtle scale-down — the iOS "press feedback" that signals "you touched me".
 *
 * Why a separate atom instead of utility classes:
 *   - `active:scale-95` Tailwind only fires on `:active`, which mobile browsers
 *     debounce inconsistently. framer-motion's `whileTap` reacts immediately
 *     and uses spring physics for the return.
 *   - Centralised reduced-motion gate: one hook reads the media query, the
 *     200+ buttons in the app inherit the behaviour without each having to
 *     check `prefers-reduced-motion` themselves.
 *
 * Drop-in replacement for `<button>` — same props (`onClick`, `disabled`,
 * `aria-*`, ...), same children. The motion props are pre-bound, so callers
 * never touch framer-motion directly.
 */
export type PressableProps = HTMLMotionProps<'button'> & {
  /** Tighter or looser tap scale. Default 0.96 matches iOS system buttons. */
  pressScale?: number
}

const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { pressScale = 0.96, type = 'button', children, disabled, ...rest },
  ref,
) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={reducedMotion || disabled ? undefined : { scale: pressScale }}
      transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.6 }}
      {...rest}
    >
      {children}
    </motion.button>
  )
})

export default Pressable
