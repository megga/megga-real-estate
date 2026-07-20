// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartDownward2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
<path d="M8.22743 15.7794V13.0301" stroke="currentColor"></path>
<path d="M15.0951 15.7794V12.0223" stroke="currentColor"></path>
<path d="M11.661 15.7792V14.763" stroke="currentColor"></path>
<path d="M18.6288 15.7792V14.763" stroke="currentColor"></path>
<path d="M19.084 11.5672L15.2623 7.1228L10.9024 10.1859L7.16319 5.86502" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartDownward2.displayName = 'LineChartDownward2'

export default LineChartDownward2
