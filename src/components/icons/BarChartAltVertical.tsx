// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartAltVertical = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M19.9994 8H14.999V20.0003H19.9994C20.5521 20.0003 20.9997 19.5527 20.9997 19.001V9.00027C20.9997 8.44759 20.5521 8 19.9994 8Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.0004 4H10.0003C9.44759 4 9 4.44759 9 5.00027V20.0014H15.0006V5.00027C15.0006 4.44759 14.553 4 14.0004 4Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartAltVertical.displayName = 'BarChartAltVertical'

export default BarChartAltVertical
