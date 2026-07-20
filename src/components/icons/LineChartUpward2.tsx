// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartUpward2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.001H6C4.89543 20.001 4 19.1055 4 18.001V4.00098" stroke="currentColor"></path>
<path d="M7.49805 12.7584C7.49805 12.7584 8.93289 9.63604 11.1379 9.57282C12.825 9.52445 13.8531 12.0237 15.8715 12.0237C18.0033 12.0237 19.6409 8.39896 19.6409 8.39896" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartUpward2.displayName = 'LineChartUpward2'

export default LineChartUpward2
