// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSearch2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.2611 12.8515C19.833 17.2293 16.1412 20.6506 11.6515 20.6506C6.87376 20.6506 3 16.7769 3 11.9991C3 7.22044 6.87376 3.34766 11.6515 3.34766C12.0164 3.34766 12.3764 3.37004 12.7296 3.41382" stroke="currentColor"></path>
<path d="M7.396 19.5349C7.56531 18.2193 8.7359 16.7578 11.6415 16.7578C14.5801 16.7578 15.7419 18.2271 15.9035 19.5593" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.1126 11.9656C14.1126 13.325 13.0102 14.4284 11.6498 14.4284C10.2905 14.4284 9.18799 13.325 9.18799 11.9656C9.18799 10.6063 10.2905 9.50378 11.6498 9.50378C13.0102 9.50378 14.1126 10.6063 14.1126 11.9656Z" stroke="currentColor"></path>
<path d="M19.7727 8.04419C18.8882 8.9287 17.4529 8.9287 16.5684 8.04419C15.6829 7.1587 15.6829 5.72441 16.5684 4.8399C17.4529 3.95441 18.8882 3.95441 19.7727 4.8399C20.6572 5.72441 20.6572 7.1587 19.7727 8.04419ZM19.7727 8.04419L20.9998 9.2718" stroke="currentColor"></path>
    </svg>
  ),
)

UserSearch2.displayName = 'UserSearch2'

export default UserSearch2
