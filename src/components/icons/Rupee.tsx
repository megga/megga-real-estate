// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Rupee = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.99854 6H9.49965C11.4318 5.99919 12.9987 7.56455 12.9987 9.49665V9.49909C12.9987 11.4312 11.4334 12.9974 9.50128 12.9982H7.99935L13.0012 18" stroke="currentColor"></path>
<path d="M7.99805 6.00293H16.0013" stroke="currentColor"></path>
<path d="M7.99805 9.36426H16.0013" stroke="currentColor"></path>
    </svg>
  ),
)

Rupee.displayName = 'Rupee'

export default Rupee
