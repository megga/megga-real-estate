// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.29491 15.2385L9.65789 17.1376L12.6363 13.9627L16.9067 14.6055L20.0002 8.8847" stroke="currentColor"></path>
<path d="M4 9.88662H7.94859L10.8363 6.61022L15.4194 9.07786L20 4.00098" stroke="currentColor"></path>
<path d="M20.0001 20.001H4.23779" stroke="currentColor"></path>
    </svg>
  ),
)

LineChart.displayName = 'LineChart'

export default LineChart
