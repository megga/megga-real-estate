// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserHearing = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.8513 5.11703C19.3276 5.83631 19.605 6.69872 19.605 7.62578C19.605 8.55285 19.3276 9.41526 18.8513 10.1345" stroke="currentColor"></path>
<path d="M5.24829 5.11703C4.77199 5.83631 4.4946 6.69872 4.4946 7.62578C4.4946 8.55285 4.77199 9.41526 5.24829 10.1345" stroke="currentColor"></path>
<path d="M7.29354 19.8768C5.88621 19.8768 5.03579 18.9636 4.97559 17.6917C4.97559 15.1029 7.77771 14.2098 11.9997 14.1797C16.2292 14.2198 19.0389 15.1129 19.0238 17.6917C18.9561 18.9636 18.1107 19.8768 16.7059 19.8768H7.29354Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M12.0057 11.2244C13.9662 11.2244 15.5554 9.63513 15.5554 7.67469C15.5554 5.71425 13.9662 4.125 12.0057 4.125C10.0453 4.125 8.45605 5.71425 8.45605 7.67469C8.45605 9.63513 10.0453 11.2244 12.0057 11.2244Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

UserHearing.displayName = 'UserHearing'

export default UserHearing
