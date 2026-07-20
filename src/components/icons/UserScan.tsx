// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserScan = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.5236 9.81018C14.5236 11.2042 13.3936 12.3342 11.9996 12.3342C10.6046 12.3342 9.47559 11.2042 9.47559 9.81018C9.47559 8.41618 10.6046 7.28516 11.9996 7.28516C13.3936 7.28516 14.5236 8.41618 14.5236 9.81018Z" stroke="currentColor"></path>
<path d="M8.04785 17.6694C8.04785 16.3794 9.06685 14.7734 11.9998 14.7734C14.9338 14.7734 15.9518 16.3684 15.9518 17.6594" stroke="currentColor"></path>
<path d="M20.9994 16.1523V17.7293C20.9994 19.8793 19.2574 21.6213 17.1074 21.6213H15.8174" stroke="currentColor"></path>
<path d="M2.99902 16.1523V17.7293C2.99902 19.8793 4.74203 21.6213 6.89203 21.6213H8.14902" stroke="currentColor"></path>
<path d="M2.99902 9.09009V7.51312C2.99902 5.36412 4.74203 3.62109 6.89203 3.62109H8.18103" stroke="currentColor"></path>
<path d="M21.0006 9.09009V7.51312C21.0006 5.36412 19.2576 3.62109 17.1076 3.62109H15.8506" stroke="currentColor"></path>
    </svg>
  ),
)

UserScan.displayName = 'UserScan'

export default UserScan
