// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const NoteLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.4807 21.2832H7.88862C5.61316 21.2832 3.76953 19.4382 3.76953 17.1632V7.40219C3.76953 5.12819 5.61316 3.2832 7.88862 3.2832H14.9847C17.2601 3.2832 19.1047 5.12819 19.1047 7.40219V10.7672" stroke="currentColor"></path>
<path d="M11.5501 14.3637H8.89648M13.9799 9.92773H8.89743H13.9799Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.8311 21.2834H16.0104C15.2376 21.2834 14.6113 20.6574 14.6113 19.8834V18.3004C14.6113 17.5284 15.2376 16.9004 16.0104 16.9004H18.8311C19.6039 16.9004 20.2311 17.5284 20.2311 18.3004V19.8834C20.2311 20.6574 19.6039 21.2834 18.8311 21.2834Z" stroke="currentColor"></path>
<path d="M19.1051 16.9258V15.8838C19.0934 14.9538 18.3303 14.2098 17.4012 14.2208C16.4906 14.2328 15.754 14.9658 15.7383 15.8758V16.9258" stroke="currentColor"></path>
    </svg>
  ),
)

NoteLock.displayName = 'NoteLock'

export default NoteLock
