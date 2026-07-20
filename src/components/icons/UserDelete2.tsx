// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserDelete2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.913 7.99553C13.913 10.2017 12.1246 11.9911 9.91751 11.9911C7.71133 11.9911 5.92285 10.2017 5.92285 7.99553C5.92285 5.78934 7.71133 4 9.91751 4C12.1246 4 13.913 5.78934 13.913 7.99553Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.91756 14.875C6.54211 14.875 3.66309 15.3853 3.66309 17.428C3.66309 19.4707 6.52568 19.9991 9.91756 19.9991C13.2913 19.9991 16.172 19.4872 16.172 17.4461C16.172 15.4034 13.3103 14.875 9.91756 14.875Z" stroke="currentColor"></path>
<path d="M20.3045 9.21442L17.1798 12.3391M20.3363 12.3714L17.1494 9.18359" stroke="currentColor"></path>
    </svg>
  ),
)

UserDelete2.displayName = 'UserDelete2'

export default UserDelete2
