// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const QRCode = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M10.0558 10.0338V3.22778H3.24976V10.0338H10.0558Z" stroke="currentColor"></path>
<path d="M13.9441 20.7271H20.7501V13.9211H13.9441V20.7271Z" stroke="currentColor"></path>
<path d="M16.3751 3.22778H13.9451V7.34778" stroke="currentColor"></path>
<path d="M20.7501 4.92878V3.22778H19.0491" stroke="currentColor"></path>
<path d="M20.7501 7.60278V10.0328H19.0491" stroke="currentColor"></path>
<path d="M13.9451 10.0327H16.1651" stroke="currentColor"></path>
<path d="M16.2673 5.59253V7.81153H18.0963" stroke="currentColor"></path>
<path d="M18.6936 5.58276V5.59276" stroke="currentColor"></path>
<path d="M6.6521 6.58163V6.67863" stroke="currentColor"></path>
<path d="M6.6521 17.2755V17.3725" stroke="currentColor"></path>
<path d="M17.3474 17.2755V17.3725" stroke="currentColor"></path>
<path d="M3.24976 13.9211V20.7271H10.0558V13.9211H3.24976Z" stroke="currentColor"></path>
    </svg>
  ),
)

QRCode.displayName = 'QRCode'

export default QRCode
