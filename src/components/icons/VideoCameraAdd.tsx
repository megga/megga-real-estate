// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoCameraAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.84984 4.75391H12.6403C15.0133 4.75391 16.4912 6.42963 16.4912 8.80051V15.1985C16.4912 17.5694 15.0133 19.2451 12.6392 19.2451H5.84984C3.47572 19.2451 2 17.5694 2 15.1985V8.80051C2 6.42963 3.48329 4.75391 5.84984 4.75391Z" stroke="currentColor"></path>
<path d="M16.4844 9.99068L19.891 7.20249C20.4423 6.75058 21.2564 6.83167 21.7083 7.38304C21.8975 7.61439 22.0013 7.90413 22.0002 8.20252L21.9883 15.8038C21.9862 16.5174 21.4078 17.0947 20.6942 17.0925C20.3958 17.0925 20.1083 16.9887 19.878 16.7995L16.4844 14.0124" stroke="currentColor"></path>
<path d="M11.5033 11.9988H7.00586M9.25466 14.2474V9.75" stroke="currentColor"></path>
    </svg>
  ),
)

VideoCameraAdd.displayName = 'VideoCameraAdd'

export default VideoCameraAdd
