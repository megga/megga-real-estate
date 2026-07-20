// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SquareChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.8374 4.42203V3.00098M18.5694 5.42687L19.5742 4.42203M19.584 9.15887H21.005" stroke="currentColor"></path>
<path d="M20.012 13.5098V16.4816C20.012 19.2596 18.045 21.0012 15.2615 21.0012H7.75048C4.96695 21.0012 3 19.2678 3 16.4816V8.51076C3 5.72356 4.96695 3.98926 7.75048 3.98926H10.2615" stroke="currentColor"></path>
<path d="M11.5215 8.68555H15.311V12.475" stroke="currentColor"></path>
<path d="M2.99512 13.7512C3.61274 13.8466 4.24552 13.8961 4.88985 13.8961C9.04535 13.8961 12.7202 11.838 14.9506 8.68555" stroke="currentColor"></path>
    </svg>
  ),
)

SquareChart.displayName = 'SquareChart'

export default SquareChart
