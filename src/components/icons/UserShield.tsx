// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.3346 14.75C7.99785 14.75 5.15234 15.2542 5.15234 17.2738C5.15234 19.2924 7.98228 19.814 11.3346 19.814" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.5809 19.9985C16.5809 19.9985 18.8288 19.3178 18.8288 17.441C18.8288 15.565 18.911 15.4189 18.7302 15.2372C18.5494 15.0556 16.8759 14.4727 16.5809 14.4727C16.286 14.4727 14.6124 15.0565 14.4317 15.2372C14.2509 15.418 14.3331 15.5642 14.3331 17.441C14.3331 19.3178 16.5809 19.9985 16.5809 19.9985Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.2841 7.94825C15.2841 10.1295 13.5162 11.8974 11.335 11.8974C9.15456 11.8974 7.38672 10.1295 7.38672 7.94825C7.38672 5.76785 9.15456 4 11.335 4C13.5162 4 15.2841 5.76785 15.2841 7.94825Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserShield.displayName = 'UserShield'

export default UserShield
