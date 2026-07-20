// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dashboard5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9699 7.02908 21 12 21C16.9709 21 21 16.9699 21 12Z" stroke="currentColor"></path>
<path d="M12 3V5.47427M12 21V18.7491M21 12H18.75M3 12H5.47524" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0006 14.8874C10.2122 14.8874 9.75591 13.1594 9.95245 12.2808C10.149 11.4022 11.0461 10.0362 12.0006 9.25586C12.955 10.0362 13.8521 11.4022 14.0487 12.2808C14.2452 13.1594 13.7889 14.8874 12.0006 14.8874Z" stroke="currentColor"></path>
    </svg>
  ),
)

Dashboard5.displayName = 'Dashboard5'

export default Dashboard5
