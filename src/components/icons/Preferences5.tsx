// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.0508 17.2578H13.9473" stroke="currentColor"></path>
<path d="M3 10.7305H6.89653" stroke="currentColor"></path>
<path d="M17.1035 10.3066H21" stroke="currentColor"></path>
<path d="M12 20.6017V17.2578" stroke="currentColor"></path>
<path d="M4.94727 20.6007V10.7305" stroke="currentColor"></path>
<path d="M19.0508 20.6011V10.3066" stroke="currentColor"></path>
<path d="M4.94727 6.6616V3.39844" stroke="currentColor"></path>
<path d="M19.0508 6.2374V3.39844" stroke="currentColor"></path>
<path d="M11.998 13.1879V3.39844" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences5.displayName = 'Preferences5'

export default Preferences5
