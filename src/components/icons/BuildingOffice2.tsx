// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingOffice2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.6142 20.906V5.24013C19.6142 4.05505 18.6539 3.09375 17.4688 3.09375H6.53455C5.34947 3.09375 4.38915 4.05505 4.38915 5.24013V20.906M3 20.9056H21" stroke="currentColor"></path>
<path d="M9.68555 20.906V15.5576C9.68555 14.966 10.1652 14.4873 10.7558 14.4873H13.2476C13.8392 14.4873 14.3188 14.966 14.3188 15.5576V20.906" stroke="currentColor"></path>
<path d="M9.99316 8.59424H14.0067" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingOffice2.displayName = 'BuildingOffice2'

export default BuildingOffice2
