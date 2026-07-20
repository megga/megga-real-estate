// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingOffice9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.1936 20.9976V5.16773C19.1936 3.97003 18.2226 3 17.0259 3H6.97632C5.7796 3 4.80859 3.97003 4.80859 5.16773V20.9976" stroke="currentColor"></path>
<path d="M13.7202 7.87134H14.7564M9.24316 7.87134H10.2794M13.7202 11.4458H14.7564M9.24316 11.4458H10.2794" stroke="currentColor"></path>
<path d="M9.66357 20.9999V16.8805C9.66357 16.2802 10.1432 15.7908 10.7435 15.7908H13.2635C13.8531 15.7908 14.3435 16.2802 14.3435 16.8805V20.9999" stroke="currentColor"></path>
<path d="M3.40576 20.9976H20.5939" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingOffice9.displayName = 'BuildingOffice9'

export default BuildingOffice9
