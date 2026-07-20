// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLock = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.9522 19.999H15.5877C14.939 19.999 14.4141 19.4741 14.4141 18.8254V17.4978C14.4141 16.8501 14.939 16.3242 15.5877 16.3242H17.9522C18.6 16.3242 19.1259 16.8501 19.1259 17.4978V18.8254C19.1259 19.4741 18.6 19.999 17.9522 19.999Z" stroke="currentColor"></path>
<path d="M18.1803 16.3498V15.4763C18.1708 14.6971 17.5308 14.0726 16.7516 14.0821C15.9879 14.0925 15.3704 14.7066 15.3574 15.4702V16.3498" stroke="currentColor"></path>
<path d="M11.0259 14.6953C7.70571 14.6953 4.875 15.1978 4.875 17.206C4.875 19.216 7.69014 19.7349 11.0259 19.7349" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9558 7.92909C14.9558 10.099 13.1967 11.8582 11.0267 11.8582C8.85679 11.8582 7.09766 10.099 7.09766 7.92909C7.09766 5.75914 8.85679 4 11.0267 4C13.1967 4 14.9558 5.75914 14.9558 7.92909Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserLock.displayName = 'UserLock'

export default UserLock
