// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartSquareDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.33398 10.8916V17.0661M11.5337 7.9375V17.0659M15.6651 14.1545V17.0656" stroke="currentColor"></path>
<path d="M11.7178 3.5H7.28313C4.34378 3.5 2.5 5.58119 2.5 8.52735V16.4736C2.5 19.4198 4.33503 21.5 7.28313 21.5H15.7169C18.6659 21.5 20.5 19.4198 20.5 16.4736V13.5274" stroke="currentColor"></path>
<path d="M15.5 6.5L18.5 9.5M18.5 9.5L21.5 6.5M18.5 9.5L18.5 2.5" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartSquareDown.displayName = 'BarChartSquareDown'

export default BarChartSquareDown
