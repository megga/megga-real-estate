// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownwardGraph = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M3 10.8222L10.0204 17.8425L13.6351 14.2287L19.6591 20.2527" stroke="currentColor"></path>
<path d="M21.0006 8.95731L17.8582 12.0189L14.7148 8.95731" stroke="currentColor"></path>
<path d="M17.8574 3.74637V12.0171" stroke="currentColor"></path>
    </svg>
  ),
)

DownwardGraph.displayName = 'DownwardGraph'

export default DownwardGraph
