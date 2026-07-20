// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartMinimum = forwardRef<SVGSVGElement, Props>(
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
<path d="M19.5093 7.42068C17.9349 7.42068 16.9055 8.9867 16.5811 11.6817C16.3927 13.2479 15.3799 15.0687 13.3528 15.0687C11.3257 15.0687 10.3129 13.2479 10.1244 11.6817C9.8001 8.9867 8.77067 7.42068 7.19629 7.42068" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartMinimum.displayName = 'LineChartMinimum'

export default LineChartMinimum
