// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartTrendUp = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
<path d="M8.04736 12.9149L11.2785 9.79397L14.3674 12.5149L18.9167 8.03575" stroke="currentColor"></path>
<path d="M16.3286 8.03677H18.9162V10.6243" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartTrendUp.displayName = 'LineChartTrendUp'

export default LineChartTrendUp
