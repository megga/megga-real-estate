// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FaceIDSucces = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.0013 16.1523V17.7293C21.0013 19.8783 19.2583 21.6213 17.1083 21.6213H15.8193" stroke="currentColor"></path>
<path d="M2.99902 16.1523V17.7293C2.99902 19.8783 4.742 21.6213 6.892 21.6213H8.14902" stroke="currentColor"></path>
<path d="M2.99902 9.09009V7.51309C2.99902 5.36309 4.742 3.62109 6.892 3.62109H8.181" stroke="currentColor"></path>
<path d="M21.0006 9.09009V7.51309C21.0006 5.36309 19.2576 3.62109 17.1076 3.62109H15.8506" stroke="currentColor"></path>
<path d="M8.56152 8.44531V9.05731M15.4395 8.44531V9.05731V8.44531Z" stroke="currentColor"></path>
<path d="M12.4677 9.76172V11.7325C12.4677 12.2553 12.3047 12.5892 11.8585 12.8616L11.5537 13.0597" stroke="currentColor"></path>
<path d="M8.56152 15.3516C10.8765 17.2546 13.1695 17.2916 15.4395 15.3516" stroke="currentColor"></path>
    </svg>
  ),
)

FaceIDSucces.displayName = 'FaceIDSucces'

export default FaceIDSucces
