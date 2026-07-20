// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldHide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.29286 7.10742C5.16786 7.84202 5.29286 9.36961 5.29286 13.6069C5.29286 19.725 12.6138 21.9386 12.6138 21.9386C12.6138 21.9386 15.2479 21.1368 17.3569 19.1802" stroke="currentColor"></path>
<path d="M18.6249 20.4501L4.00488 5.83008" stroke="currentColor"></path>
<path d="M9.02246 4.95816C10.5595 4.40648 12.1375 3.93945 12.6135 3.93945C13.5775 3.93945 19.0275 5.83871 19.6195 6.43028C20.2005 7.02186 19.9345 7.49959 19.9345 13.608C19.9345 14.1811 19.8715 14.724 19.7535 15.2329" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldHide.displayName = 'ShieldHide'

export default ShieldHide
