// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MovieTime = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.1283 10.3537V7.76655C20.1283 4.97414 18.3886 3 15.5933 3H7.59553C4.79825 3 3.05859 4.97414 3.05859 7.76655V15.38C3.05859 18.1724 4.79825 20.1465 7.59455 20.1465H10.2031" stroke="currentColor"></path>
<path d="M3.06641 7.46875H20.1234" stroke="currentColor"></path>
<path d="M8.62305 7.46785V3M14.5654 7.46785V3" stroke="currentColor"></path>
<path d="M16.8883 20.9993C19.1262 20.9993 20.9407 19.1847 20.9407 16.9469C20.9407 14.7091 19.1262 12.8945 16.8883 12.8945C14.6505 12.8945 12.8359 14.7091 12.8359 16.9469C12.8359 19.1847 14.6505 20.9993 16.8883 20.9993Z" stroke="currentColor"></path>
<path d="M18.1486 18.0018L16.8672 17.2361V15.5898" stroke="currentColor"></path>
    </svg>
  ),
)

MovieTime.displayName = 'MovieTime'

export default MovieTime
