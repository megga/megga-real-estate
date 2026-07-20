// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartMaximum = forwardRef<SVGSVGElement, Props>(
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
<path d="M19.5093 15.0687C17.9349 15.0687 16.9055 13.5027 16.5811 10.8077C16.3927 9.24145 15.3799 7.42072 13.3528 7.42072C11.3257 7.42072 10.3129 9.24145 10.1244 10.8077C9.8001 13.5027 8.77067 15.0687 7.19629 15.0687" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartMaximum.displayName = 'LineChartMaximum'

export default LineChartMaximum
