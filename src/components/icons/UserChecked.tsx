// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserChecked = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.96191 19.999C4.96191 17.8904 6.62649 15.2656 11.4203 15.2656" stroke="currentColor"></path>
<path d="M13.8232 18.0599L15.5275 19.7668L19.0386 16.2539" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.5467 8.12542C15.5467 10.4034 13.6993 12.2508 11.4213 12.2508C9.14333 12.2508 7.2959 10.4034 7.2959 8.12542C7.2959 5.84743 9.14333 4 11.4213 4C13.6993 4 15.5467 5.84743 15.5467 8.12542Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserChecked.displayName = 'UserChecked'

export default UserChecked
