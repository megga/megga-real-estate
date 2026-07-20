// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserGem = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.9177 17.41L21.038 13.9426L19.9979 12.0879H15.8375L14.7974 13.9426L17.9177 17.41Z" stroke="currentColor"></path>
<path d="M14.7166 19.8768H5.30429C3.89695 19.8768 3.04653 18.9636 2.98633 17.6917C2.98633 15.1029 5.78845 14.2098 10.0104 14.1797C10.4799 14.1841 10.9319 14.1991 11.3645 14.2257" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M10.0165 11.2244C11.9769 11.2244 13.5662 9.63513 13.5662 7.67469C13.5662 5.71425 11.9769 4.125 10.0165 4.125C8.05605 4.125 6.4668 5.71425 6.4668 7.67469C6.4668 9.63513 8.05605 11.2244 10.0165 11.2244Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

UserGem.displayName = 'UserGem'

export default UserGem
