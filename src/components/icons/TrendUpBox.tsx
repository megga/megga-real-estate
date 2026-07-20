// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendUpBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 7.78265V16.2174C21 19.1655 18.9188 21.0005 15.9736 21.0005H8.02638C5.08119 21.0005 3 19.1655 3 16.2164V7.78265C3 4.83454 5.08119 3.00049 8.02638 3.00049H15.9736C18.9188 3.00049 21 4.8433 21 7.78265Z" stroke="currentColor"></path>
<path d="M12.9551 8.84308L16.0793 8.00049L16.9229 11.1247" stroke="currentColor"></path>
<path d="M16.0801 8.00049L12.4664 14.282L9.16028 12.3798L7.07617 16.0032" stroke="currentColor"></path>
    </svg>
  ),
)

TrendUpBox.displayName = 'TrendUpBox'

export default TrendUpBox
