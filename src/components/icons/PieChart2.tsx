// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PieChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.84385 5.4763C5.49281 6.00364 2.24801 10.1173 3.15188 14.7729C3.74247 17.8104 6.19041 20.2584 9.22797 20.848C13.8835 21.7528 17.9972 18.508 18.5245 14.157C18.5848 13.6549 18.1889 13.2103 17.6829 13.2103H11.6321C11.1671 13.2103 10.7905 12.8338 10.7905 12.3677V6.3179C10.7905 5.81197 10.3459 5.41598 9.84385 5.4763Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.9938 9.25988C20.5666 6.00925 17.9922 3.43482 14.7416 3.0077C14.2366 2.94153 13.7852 3.33947 13.7852 3.84833V9.37566C13.7852 9.83976 14.1617 10.2163 14.6268 10.2163H20.1531C20.663 10.2163 21.0599 9.76582 20.9938 9.25988Z" stroke="currentColor"></path>
    </svg>
  ),
)

PieChart2.displayName = 'PieChart2'

export default PieChart2
