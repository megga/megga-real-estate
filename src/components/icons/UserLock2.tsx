// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.8737 12.711V11.6344C19.8619 10.6741 19.0732 9.90455 18.1128 9.91627C17.1717 9.92906 16.4107 10.6858 16.3947 11.627V12.711M19.5914 17.2112H16.6773C15.8779 17.2112 15.231 16.5642 15.231 15.7648V14.1287C15.231 13.3303 15.8779 12.6823 16.6773 12.6823H19.5914C20.3898 12.6823 21.0378 13.3303 21.0378 14.1287V15.7648C21.0378 16.5642 20.3898 17.2112 19.5914 17.2112Z" stroke="currentColor"></path>
<path d="M14.7967 19.8768H5.38436C3.97703 19.8768 3.12661 18.9636 3.06641 17.6917C3.06641 15.1029 5.86853 14.2098 10.0905 14.1797C10.56 14.1841 11.012 14.1991 11.4445 14.2257" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M10.0966 11.2244C12.057 11.2244 13.6463 9.63513 13.6463 7.67469C13.6463 5.71425 12.057 4.125 10.0966 4.125C8.13613 4.125 6.54688 5.71425 6.54688 7.67469C6.54688 9.63513 8.13613 11.2244 10.0966 11.2244Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

UserLock2.displayName = 'UserLock2'

export default UserLock2
