// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserBoard2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.9467 19.6427H17.3999C20.2357 19.6427 22.0001 17.6415 22.0001 14.809V8.23025C22.0001 5.39767 20.2357 3.39648 17.401 3.39648H9.69464C7.67399 3.39648 6.19283 4.41924 5.51172 6.0377" stroke="currentColor"></path>
<path d="M17.8688 16.3203H15.5649" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.43374 16.9727C4.04119 16.9727 2 17.3338 2 18.7825C2 20.2312 4.02929 20.6042 6.43374 20.6042C8.82522 20.6042 10.8675 20.242 10.8675 18.7955C10.8675 17.3478 8.83819 16.9727 6.43374 16.9727Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.20528 11.7029C9.20528 13.1743 8.01279 14.3668 6.54136 14.3668C5.06994 14.3668 3.87744 13.1743 3.87744 11.7029C3.87744 10.2314 5.06994 9.03894 6.54136 9.03894C8.01279 9.03894 9.20528 10.2314 9.20528 11.7029Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserBoard2.displayName = 'UserBoard2'

export default UserBoard2
