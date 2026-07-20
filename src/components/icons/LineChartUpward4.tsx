// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartUpward4 = forwardRef<SVGSVGElement, Props>(
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
<path d="M18.0196 15.7794V13.0301" stroke="currentColor"></path>
<path d="M11.152 15.7794V12.0223" stroke="currentColor"></path>
<path d="M14.586 15.7792V14.763" stroke="currentColor"></path>
<path d="M7.61825 15.7792V14.763" stroke="currentColor"></path>
<path d="M7.16309 11.5672L10.9847 7.1228L15.3447 10.1859L19.0839 5.86502" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartUpward4.displayName = 'LineChartUpward4'

export default LineChartUpward4
