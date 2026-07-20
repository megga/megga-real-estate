// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingOffice6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.1935 21V5.16778C19.1935 3.97103 18.2225 3 17.0247 3H6.97589C5.77816 3 4.80713 3.97103 4.80713 5.16778V21" stroke="currentColor"></path>
<path d="M13.7194 8.31055H14.7556M9.24219 8.31055H10.2784M13.7194 12.2927H14.7556M9.24219 12.2927H10.2784M13.7194 16.2749H14.7556M9.24219 16.2749H10.2784" stroke="currentColor"></path>
<path d="M3.40479 21H20.5953" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingOffice6.displayName = 'BuildingOffice6'

export default BuildingOffice6
