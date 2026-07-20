// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scan3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M22.582 12.8H1.44995" stroke="currentColor"></path>
<path d="M2.99609 8.71995C3.56609 5.23995 5.28609 3.51995 8.76609 2.94995" stroke="currentColor"></path>
<path d="M8.76603 20.9901C5.28603 20.4101 3.56603 18.7001 2.99603 15.2201L2.99503 15.2241C2.87403 14.5041 2.80503 13.6941 2.78503 12.8041" stroke="currentColor"></path>
<path d="M21.2445 12.804C21.2245 13.694 21.1545 14.504 21.0345 15.224L21.0365 15.22C20.4655 18.7 18.7455 20.41 15.2655 20.99" stroke="currentColor"></path>
<path d="M15.266 2.94995C18.746 3.51995 20.466 5.23995 21.036 8.71995" stroke="currentColor"></path>
    </svg>
  ),
)

Scan3.displayName = 'Scan3'

export default Scan3
