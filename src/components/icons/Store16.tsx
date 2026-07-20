// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store16 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.88697 4.12696V6.89503L3.0259 10.5611C2.88385 11.1673 3.34406 11.7482 3.96675 11.7482H20.0323C20.6559 11.7482 21.1162 11.1673 20.9741 10.5602L20.0936 6.82108L20.151 4.1435C20.1597 3.71053 19.8114 3.3554 19.3794 3.3554H4.65853C4.23237 3.3554 3.88697 3.7008 3.88697 4.12696Z" stroke="currentColor"></path>
<path d="M3.95947 11.7483V18.7254C3.95947 19.7849 4.8186 20.6441 5.87815 20.6441H18.1024C19.162 20.6441 20.0211 19.7849 20.0211 18.7254V11.7483M11.9997 20.6448H16.1396" stroke="currentColor"></path>
<path d="M12 20.6446V14.4761H16.1399V20.6446" stroke="currentColor"></path>
<path d="M7.26611 15.6809H8.4181" stroke="currentColor"></path>
<path d="M3.88672 6.89502L20.0938 6.89567" stroke="currentColor"></path>
    </svg>
  ),
)

Store16.displayName = 'Store16'

export default Store16
