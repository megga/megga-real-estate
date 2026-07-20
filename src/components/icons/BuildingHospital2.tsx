// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingHospital2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.7636 10.1984H19.4721C20.1191 10.1984 20.6426 10.7228 20.6426 11.3689V20.9993H3.35693V11.3689C3.35693 10.7228 3.88136 10.1984 4.52838 10.1984H6.2369" stroke="currentColor"></path>
<path d="M17.765 20.9996V7.27011C17.765 6.37304 17.0382 5.64526 16.1401 5.64526H7.86216C6.96508 5.64526 6.23828 6.37304 6.23828 7.27011V20.9996" stroke="currentColor"></path>
<path d="M10.0518 21V16.5011C10.0518 16.0039 10.4546 15.6001 10.9527 15.6001H13.0485C13.5457 15.6001 13.9494 16.0039 13.9494 16.5011V21" stroke="currentColor"></path>
<path d="M10.4814 10.6279H13.52M11.9998 9.10864V12.1472" stroke="currentColor"></path>
<path d="M10.2666 3H13.7352" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingHospital2.displayName = 'BuildingHospital2'

export default BuildingHospital2
