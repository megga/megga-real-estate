// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WaterfallChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.001H6C4.89543 20.001 4 19.1055 4 18.001V4.00098" stroke="currentColor"></path>
<path d="M7.7959 19.7935L7.7959 12.001" stroke="currentColor"></path>
<path d="M11.1318 12.8696V4.6543" stroke="currentColor"></path>
<path d="M14.4678 19.7935L14.4678 4.6543" stroke="currentColor"></path>
<path d="M17.8037 19.7935V14.2744" stroke="currentColor"></path>
    </svg>
  ),
)

WaterfallChart.displayName = 'WaterfallChart'

export default WaterfallChart
