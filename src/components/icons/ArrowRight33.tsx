// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRight33 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M20.2497 12L4.24993 12" stroke="currentColor"></path>
<path d="M14.59 17.66C14.59 14.7503 17.1526 12 20.2501 12" stroke="currentColor"></path>
<path d="M14.59 6.33995C14.59 9.2497 17.1526 12 20.2501 12" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowRight33.displayName = 'ArrowRight33'

export default ArrowRight33
