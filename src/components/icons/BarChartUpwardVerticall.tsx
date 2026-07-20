// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartUpwardVerticall = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.00027 11.9992H9.00064V20.0004H4.00027C3.44759 20.0004 3 19.5518 3 19.0001V12.9995C3 12.4468 3.44759 11.9992 4.00027 11.9992Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.0003 8H15.0006V20.0003H9V9.00027C9 8.44759 9.44759 8 10.0003 8Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.9993 4H19.9994C20.5521 4 20.9997 4.44759 20.9997 5.00027V19.0011C20.9997 19.5528 20.5521 20.0014 19.9994 20.0014H14.999V5.00027C14.999 4.44759 15.4466 4 15.9993 4Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartUpwardVerticall.displayName = 'BarChartUpwardVerticall'

export default BarChartUpwardVerticall
