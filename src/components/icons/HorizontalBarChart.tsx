// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HorizontalBarChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.50781 9.99786L11.69 9.99786" stroke="currentColor"></path>
<path d="M8.50879 5.2254L18.1239 5.2254" stroke="currentColor"></path>
<path d="M8.50635 14.7686L13.2557 14.7686" stroke="currentColor"></path>
<path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
    </svg>
  ),
)

HorizontalBarChart.displayName = 'HorizontalBarChart'

export default HorizontalBarChart
