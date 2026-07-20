// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AreaChart = forwardRef<SVGSVGElement, Props>(
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
<path d="M4.31445 12.8487L8.96621 8.40426L14.3087 12.3346L18.8246 7.14648" stroke="currentColor"></path>
<path d="M4.31445 16.94L8.96621 14.4864L14.2732 16.1774L18.8246 13.792" stroke="currentColor"></path>
<path d="M4.31445 7.149L8.96621 4.69536L14.2732 6.38641L18.8246 4.00098" stroke="currentColor"></path>
    </svg>
  ),
)

AreaChart.displayName = 'AreaChart'

export default AreaChart
