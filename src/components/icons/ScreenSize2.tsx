// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScreenSize2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9998 15.4142V17.9255C20.9998 19.6233 19.6231 21 17.9243 21H15.4141" stroke="currentColor"></path>
<path d="M3 15.4141V17.9253C3 19.6231 4.37674 20.9998 6.07552 20.9998H8.58575" stroke="currentColor"></path>
<path d="M3 8.58673V6.07552C3 4.37674 4.37674 3 6.07552 3H8.58575" stroke="currentColor"></path>
<path d="M20.9998 8.58673V6.07552C20.9998 4.37674 19.6231 3 17.9243 3H15.4141" stroke="currentColor"></path>
    </svg>
  ),
)

ScreenSize2.displayName = 'ScreenSize2'

export default ScreenSize2
