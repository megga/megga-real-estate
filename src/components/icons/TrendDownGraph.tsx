// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendDownGraph = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.2983 18.153L19.2983 21.0006" stroke="currentColor"></path>
<path d="M14.167 16.7969L14.167 21.0005" stroke="currentColor"></path>
<path d="M9.03564 14.085L9.03564 21.0005" stroke="currentColor"></path>
<path d="M3.9043 10.1523L3.9043 21.0003" stroke="currentColor"></path>
<path d="M18.4748 10.1465L20.4963 12.5802L18.2891 14.3522" stroke="currentColor"></path>
<path d="M3.28857 3.32129C3.28857 3.32129 8.1493 12.3479 20.4961 12.5802" stroke="currentColor"></path>
    </svg>
  ),
)

TrendDownGraph.displayName = 'TrendDownGraph'

export default TrendDownGraph
