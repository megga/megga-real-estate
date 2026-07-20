// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingOffice = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 19.5091H21" stroke="currentColor"></path>
<path d="M7.83594 8.92139H8.69994M7.83594 12.2441H8.69994M7.83594 15.5669H8.69994" stroke="currentColor"></path>
<path d="M15.7754 13.3521H16.6394M15.7754 16.6748H16.6394" stroke="currentColor"></path>
<path d="M12.2596 19.5095V6.36856C12.2596 5.33137 11.419 4.49072 10.3818 4.49072H6.15323C5.11604 4.49072 4.27539 5.33137 4.27539 6.36856V19.5095" stroke="currentColor"></path>
<path d="M19.8144 19.509V12.1825C19.8144 11.1453 18.9738 10.3047 17.9366 10.3047H12.2593V19.509" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingOffice.displayName = 'BuildingOffice'

export default BuildingOffice
