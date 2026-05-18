import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * `<Shimmer>` replaces `animate-pulse` for skeleton states. The Tailwind pulse
 * is just opacity oscillation — fine, but it reads as "broken/loading" rather
 * than "polished placeholder".
 *
 * Shimmer slides a thin diagonal gradient over a neutral base, which is the
 * pattern Apple uses in Photos, Stocks, and the App Store (and Netflix/Stripe
 * for the same reason). Costs are similar (GPU-accelerated background-position
 * animation, no JS per frame).
 *
 * Use it as a wrapper around shaped placeholders:
 *
 *   <Shimmer className="h-6 w-40 rounded" />          // single bar
 *   <Shimmer className="h-32 w-full rounded-xl" />    // card placeholder
 *
 * Or composing skeletons:
 *
 *   <div className="space-y-2">
 *     <Shimmer className="h-6 w-2/3" />
 *     <Shimmer className="h-4 w-1/2" />
 *   </div>
 *
 * The animation respects `prefers-reduced-motion`: the underlying CSS does
 * not animate when the user opts out (handled in tailwind.config keyframes
 * via the media query). Falls back to a static neutral block.
 */

interface ShimmerProps {
  className?: string
  /** Defaults to `block` div. Pass `circle` for round avatars. */
  shape?: 'block' | 'circle'
  style?: CSSProperties
  children?: ReactNode
}

export default function Shimmer({ className, shape = 'block', style, children }: ShimmerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'megga-shimmer',
        shape === 'circle' && 'rounded-full',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}
