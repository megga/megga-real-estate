// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendUpGraph = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.70068 18.153L4.70068 21.0006" stroke="currentColor"></path>
<path d="M9.83252 16.797L9.83252 21.0006" stroke="currentColor"></path>
<path d="M14.9639 14.0849L14.9639 21.0005" stroke="currentColor"></path>
<path d="M20.0952 10.1526L20.0952 21.0006" stroke="currentColor"></path>
<path d="M16.9771 3.53444L20.0954 3.00061L20.5264 5.79811" stroke="currentColor"></path>
<path d="M3.47314 13.2733C3.47314 13.2733 13.7208 13.5772 20.0954 3.00061" stroke="currentColor"></path>
    </svg>
  ),
)

TrendUpGraph.displayName = 'TrendUpGraph'

export default TrendUpGraph
