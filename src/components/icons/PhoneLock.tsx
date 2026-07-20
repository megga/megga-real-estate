// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PhoneLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.4203 3.95898H9.1424C7.14439 3.95898 5.52539 5.57897 5.52539 7.57697L5.52637 18.341C5.52637 20.338 7.14537 21.958 9.14337 21.958H14.6584C16.6564 21.958 18.2764 20.338 18.2764 18.34L18.2754 13.876" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.934 11.4518H13.831C12.981 11.4518 12.291 10.7629 12.291 9.91187V8.17087C12.291 7.31987 12.981 6.63086 13.831 6.63086H16.934C17.784 6.63086 18.474 7.31987 18.474 8.17087V9.91187C18.474 10.7629 17.784 11.4518 16.934 11.4518Z" stroke="currentColor"></path>
<path d="M17.2343 6.66113V5.78815C17.2223 4.76615 16.3823 3.94614 15.3603 3.95914C14.3583 3.97214 13.5473 4.77815 13.5312 5.78015V6.66113" stroke="currentColor"></path>
<path d="M11.8976 18.2252V18.1612V18.2252ZM11.6387 18.2112C11.6387 18.0672 11.7557 17.9512 11.8997 17.9512C12.0437 17.9512 12.1597 18.0672 12.1597 18.2112C12.1597 18.3562 12.0437 18.4722 11.8997 18.4722C11.7557 18.4722 11.6387 18.3562 11.6387 18.2112Z" stroke="currentColor"></path>
    </svg>
  ),
)

PhoneLock.displayName = 'PhoneLock'

export default PhoneLock
