// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLock4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.7344 16.2332V15.3325C17.7247 14.5282 17.0646 13.8849 16.2603 13.8946C15.4737 13.9044 14.8366 14.5388 14.8233 15.3263V16.2332M17.4977 19.9994H15.0591C14.3901 19.9994 13.8486 19.4579 13.8486 18.7889V17.4201C13.8486 16.7521 14.3901 16.2097 15.0591 16.2097H17.4977C18.1657 16.2097 18.7081 16.7521 18.7081 17.4201V18.7889C18.7081 19.4579 18.1657 19.9994 17.4977 19.9994Z" stroke="currentColor"></path>
<path d="M5.29199 19.7171C5.29199 17.6457 6.92627 15.0664 11.6362 15.0664" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.6881 8.05252C15.6881 10.2903 13.8733 12.105 11.6355 12.105C9.39779 12.105 7.58301 10.2903 7.58301 8.05252C7.58301 5.8139 9.39779 4 11.6355 4C13.8733 4 15.6881 5.8139 15.6881 8.05252Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserLock4.displayName = 'UserLock4'

export default UserLock4
