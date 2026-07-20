// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserBadge = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.9956 3L9.92799 5.06757H7.87891C5.26939 5.06757 3.64355 6.90551 3.64355 9.51405V16.5525C3.64355 19.1621 5.26064 21 7.87891 21H16.121C18.7305 21 20.3563 19.1621 20.3563 16.5525V9.51405C20.3563 6.90551 18.7305 5.06757 16.121 5.06757H14.0631L11.9956 3Z" stroke="currentColor"></path>
<path d="M7.35889 20.9268V20.1134C7.35889 18.5995 8.55759 16.7109 11.9951 16.7109C15.4414 16.7109 16.6401 18.582 16.6401 20.0959V20.9268" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9601 11.5838C14.9601 13.2203 13.6339 14.5465 11.9974 14.5465C10.3608 14.5465 9.03369 13.2203 9.03369 11.5838C9.03369 9.94726 10.3608 8.62109 11.9974 8.62109C13.6339 8.62109 14.9601 9.94726 14.9601 11.5838Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserBadge.displayName = 'UserBadge'

export default UserBadge
