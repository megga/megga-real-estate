// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EuroCircle = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M13.1451 15.6294C11.7323 15.6839 10.4061 14.9483 9.70561 13.7194C9.10334 12.6521 9.10334 11.3473 9.70561 10.28C10.4061 9.05207 11.7323 8.31553 13.1451 8.37001" stroke="currentColor"></path>
<path d="M8.60547 13.0664H12.8408" stroke="currentColor"></path>
<path d="M8.60547 10.9336H12.8408" stroke="currentColor"></path>
    </svg>
  ),
)

EuroCircle.displayName = 'EuroCircle'

export default EuroCircle
