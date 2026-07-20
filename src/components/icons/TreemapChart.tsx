// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TreemapChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 20.0005L3 4.00049C3 3.4482 3.44772 3.00049 4 3.00049L20 3.00049C20.5523 3.00049 21 3.4482 21 4.00049L21 20.0005C21 20.5528 20.5523 21.0005 20 21.0005L4 21.0005C3.44771 21.0005 3 20.5528 3 20.0005Z" stroke="currentColor"></path>
<path d="M15 9.00049L15 21.0005" stroke="currentColor"></path>
<path d="M17.9482 3.00049L17.9482 9.00049" stroke="currentColor"></path>
<path d="M12 3.00049L12 9.00049" stroke="currentColor"></path>
<path d="M9.90527 15.0005L9.90527 21.0005" stroke="currentColor"></path>
<path d="M7.16406 9.00049L7.16406 15.0005" stroke="currentColor"></path>
<path d="M15 15.0005L3 15.0005" stroke="currentColor"></path>
<path d="M20.8965 17.0005L15 17.0005" stroke="currentColor"></path>
<path d="M21 9.00049L3 9.00049" stroke="currentColor"></path>
    </svg>
  ),
)

TreemapChart.displayName = 'TreemapChart'

export default TreemapChart
