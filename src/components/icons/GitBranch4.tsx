// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitBranch4 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.23061 17.4019C9.23061 18.836 8.06744 19.9992 6.63337 19.9992C5.1993 19.9992 4.03613 18.836 4.03613 17.4019C4.03613 15.9679 5.1993 14.8047 6.63337 14.8047C8.06744 14.8047 9.23061 15.9679 9.23061 17.4019Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.964 6.59724C19.964 8.03131 18.8008 9.19448 17.3668 9.19448C15.9327 9.19448 14.7695 8.03131 14.7695 6.59724C14.7695 5.16317 15.9327 4 17.3668 4C18.8008 4 19.964 5.16317 19.964 6.59724Z" stroke="currentColor"></path>
<path d="M6.57227 14.8084V5.03906" stroke="currentColor"></path>
<path d="M9.21777 17.5866C13.6791 17.372 17.2375 13.7064 17.2643 9.19141" stroke="currentColor"></path>
    </svg>
  ),
)

GitBranch4.displayName = 'GitBranch4'

export default GitBranch4
