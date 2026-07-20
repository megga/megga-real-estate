// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HistogramChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.001L3 12.001" stroke="currentColor"></path>
<path d="M5 12.0049V8.30664H7.33326V12.0049" stroke="currentColor"></path>
<path d="M9.66699 12.001V5.65381H12.0003V12.001" stroke="currentColor"></path>
<path d="M14.333 12.0049L14.333 3.00098H16.6663V12.0049" stroke="currentColor"></path>
<path d="M7.33301 12.0049V18.3481H9.66627V12.0049" stroke="currentColor"></path>
<path d="M12 12.0049V21.001H14.3333V12.0049" stroke="currentColor"></path>
<path d="M16.667 12.0049L16.667 18.3481H19.0003V12.0049" stroke="currentColor"></path>
    </svg>
  ),
)

HistogramChart.displayName = 'HistogramChart'

export default HistogramChart
