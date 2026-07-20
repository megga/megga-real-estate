// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ColumnChart = forwardRef<SVGSVGElement, Props>(
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
<path d="M11 20.001V8.00098C11 7.44869 10.5523 7.00098 10 7.00098H9C8.44772 7.00098 8 7.44869 8 8.00098V20.001" stroke="currentColor"></path>
<path d="M17.5 20.001V13.085C17.5 12.5327 17.0523 12.085 16.5 12.085H15.5C14.9477 12.085 14.5 12.5327 14.5 13.085V20.001" stroke="currentColor"></path>
    </svg>
  ),
)

ColumnChart.displayName = 'ColumnChart'

export default ColumnChart
