// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLoad2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.1681 3.68426C14.1629 3.29115 13.0682 3.0761 11.9239 3.0761C6.99537 3.0761 3 7.07147 3 12C3 16.9285 6.99537 20.9239 11.9239 20.9239C16.8524 20.9239 20.8478 16.9285 20.8478 12C20.8478 9.61017 19.9078 7.43929 18.3782 5.83764" stroke="currentColor"></path>
<path d="M20.9998 6.20097L18.4163 5.60352L17.8218 8.17238" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.7897 11.195C14.7897 12.7351 13.5411 13.9825 12.001 13.9825C10.462 13.9825 9.21338 12.7351 9.21338 11.195C9.21338 9.65482 10.462 8.40625 12.001 8.40625C13.5411 8.40625 14.7897 9.65482 14.7897 11.195Z" stroke="currentColor"></path>
<path d="M7.63281 19.7133C7.63281 18.2889 8.76009 16.5117 11.995 16.5117C15.2389 16.5117 16.3662 18.2733 16.3662 19.6966" stroke="currentColor"></path>
    </svg>
  ),
)

UserLoad2.displayName = 'UserLoad2'

export default UserLoad2
