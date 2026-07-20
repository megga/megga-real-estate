// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User18 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.9425" cy="8.6925" r="4.6925" stroke="currentColor"></circle>
<path d="M14.1379 13.668H9.86201C7.43688 13.668 5.47092 15.6339 5.47092 18.0591C5.47092 18.1462 5.47008 18.2336 5.46891 18.3213C5.45588 19.2937 6.24592 19.9999 7.21844 19.9999H16.7815C17.754 19.9999 18.544 19.2937 18.531 18.3213C18.5298 18.2336 18.529 18.1462 18.529 18.0591C18.529 15.6339 16.563 13.668 14.1379 13.668Z" stroke="currentColor"></path>
    </svg>
  ),
)

User18.displayName = 'User18'

export default User18
