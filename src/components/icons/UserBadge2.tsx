// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserBadge2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0004 21L9.93283 18.9324H7.875C5.26548 18.9324 3.63867 17.0945 3.63867 14.4859V7.44746C3.63867 4.83795 5.27424 3 7.875 3H16.1258C18.7353 3 20.3612 4.83795 20.3612 7.44746V14.4859C20.3612 17.0945 18.7353 18.9324 16.1258 18.9324H14.068L12.0004 21Z" stroke="currentColor"></path>
<path d="M7.35938 18.8602V18.0468C7.35938 16.5329 8.55808 14.6443 11.9956 14.6443C15.4419 14.6443 16.6406 16.5163 16.6406 18.0293V18.8602" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.961 9.51538C14.961 11.1519 13.6349 12.4781 11.9983 12.4781C10.3618 12.4781 9.03467 11.1519 9.03467 9.51538C9.03467 7.87884 10.3618 6.55267 11.9983 6.55267C13.6349 6.55267 14.961 7.87884 14.961 9.51538Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserBadge2.displayName = 'UserBadge2'

export default UserBadge2
