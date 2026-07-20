// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserChecked2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.622 7.99553C13.622 10.2017 11.8336 11.9911 9.6265 11.9911C7.42031 11.9911 5.63184 10.2017 5.63184 7.99553C5.63184 5.78934 7.42031 4 9.6265 4C11.8336 4 13.622 5.78934 13.622 7.99553Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.62654 14.875C6.2511 14.875 3.37207 15.3853 3.37207 17.428C3.37207 19.4707 6.23467 19.9991 9.62654 19.9991C13.0003 19.9991 15.881 19.4872 15.881 17.4461C15.881 15.4034 13.0193 14.875 9.62654 14.875Z" stroke="currentColor"></path>
<path d="M16.3721 10.8604L17.7627 12.2536L20.6279 9.38672" stroke="currentColor"></path>
    </svg>
  ),
)

UserChecked2.displayName = 'UserChecked2'

export default UserChecked2
