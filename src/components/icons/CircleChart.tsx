// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircleChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9512 12.901C20.4996 17.449 16.6624 21.001 11.9956 21.001C7.02504 21.001 2.99561 16.9715 2.99561 12.001C2.99561 7.33416 6.54761 3.49696 11.0956 3.04541" stroke="currentColor"></path>
<path d="M15.2533 8.40088C13.1344 11.3957 9.64332 13.3509 5.69559 13.3509C4.79298 13.3509 3.91424 13.2487 3.07031 13.0552" stroke="currentColor"></path>
<path d="M15.1455 4.35098V3.00098M18.6909 5.30557L19.6455 4.35098M19.6547 8.85098H21.0047" stroke="currentColor"></path>
<path d="M11.9956 8.40088H15.5956V12.0009" stroke="currentColor"></path>
    </svg>
  ),
)

CircleChart.displayName = 'CircleChart'

export default CircleChart
