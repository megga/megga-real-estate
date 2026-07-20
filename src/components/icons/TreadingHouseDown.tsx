// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TreadingHouseDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.78418 21.001H17.2156C19.0506 21.001 20.5373 19.5133 20.5373 17.6792V10.5054C20.5373 9.61412 20.1365 8.77054 19.4456 8.20718L13.8714 3.66723C12.7817 2.77889 11.2181 2.77889 10.1283 3.66723L4.55409 8.20718C3.86327 8.77054 3.4624 9.61412 3.4624 10.5054V17.6792C3.4624 19.5133 4.94913 21.001 6.78418 21.001Z" stroke="currentColor"></path>
<path d="M16.376 15.9073L13.5706 12.2622L10.3706 14.7747L7.62541 11.2314" stroke="currentColor"></path>
    </svg>
  ),
)

TreadingHouseDown.displayName = 'TreadingHouseDown'

export default TreadingHouseDown
