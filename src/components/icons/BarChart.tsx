// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.001H6C4.89543 20.001 4 19.1055 4 18.001L4 4.00098" stroke="currentColor"></path>
<path d="M4 10.001L16 10.001C16.5523 10.001 17 9.55326 17 9.00098L17 8.00098C17 7.44869 16.5523 7.00098 16 7.00098L4 7.00098" stroke="currentColor"></path>
<path d="M4 16.501L10.916 16.501C11.4683 16.501 11.916 16.0533 11.916 15.501L11.916 14.501C11.916 13.9487 11.4683 13.501 10.916 13.501L4 13.501" stroke="currentColor"></path>
    </svg>
  ),
)

BarChart.displayName = 'BarChart'

export default BarChart
