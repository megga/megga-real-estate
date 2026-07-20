// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendDownBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 16.2183V7.78362C21 4.83552 18.9188 3.00049 15.9736 3.00049H8.02638C5.08119 3.00049 3 4.83552 3 7.7846V16.2183C3 19.1664 5.08119 21.0005 8.02638 21.0005H15.9736C18.9188 21.0005 21 19.1577 21 16.2183Z" stroke="currentColor"></path>
<path d="M12.9551 15.1581L16.0803 16.001L16.9229 12.8755" stroke="currentColor"></path>
<path d="M16.082 16.0032L12.4684 9.72168L9.16223 11.6238L7.07812 8.00049" stroke="currentColor"></path>
    </svg>
  ),
)

TrendDownBox.displayName = 'TrendDownBox'

export default TrendDownBox
