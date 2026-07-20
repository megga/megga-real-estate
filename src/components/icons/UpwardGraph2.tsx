// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpwardGraph2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 13.1782L10.0204 6.15781L13.6351 9.77259L19.6591 3.74763" stroke="currentColor"></path>
<path d="M21.0006 15.0428L17.8582 11.9807L14.7148 15.0428" stroke="currentColor"></path>
<path d="M17.8574 20.2514V11.9807" stroke="currentColor"></path>
    </svg>
  ),
)

UpwardGraph2.displayName = 'UpwardGraph2'

export default UpwardGraph2
