// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LiraCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M10.7598 8.08594V12.6083C10.7598 14.2478 12.0888 15.5769 13.7293 15.5769H15.1323" stroke="currentColor"></path>
<path d="M8.76758 9.68262H13.4135" stroke="currentColor"></path>
<path d="M8.76758 12.0684H13.4135" stroke="currentColor"></path>
    </svg>
  ),
)

LiraCircle.displayName = 'LiraCircle'

export default LiraCircle
