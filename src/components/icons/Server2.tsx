// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Server2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 16.3879V18.5684C21 19.9986 19.9901 20.8889 18.5608 20.8889H5.43924C4.00995 20.8889 3 19.9986 3 18.5684V16.3879C3 14.9577 4.00995 14.0674 5.43924 14.0674H18.5608C19.9901 14.0674 21 14.9615 21 16.3879Z" stroke="currentColor"></path>
<path d="M21 5.43187V7.6123C21 9.04257 19.9901 9.93284 18.5608 9.93284H5.43924C4.00995 9.93284 3 9.04257 3 7.6123V5.43187C3 4.0016 4.00995 3.11133 5.43924 3.11133H18.5608C19.9901 3.11133 21 4.00549 21 5.43187Z" stroke="currentColor"></path>
<path d="M11.2469 6.52246H6.69141" stroke="currentColor"></path>
<path d="M6.69141 17.4775H11.2469" stroke="currentColor"></path>
    </svg>
  ),
)

Server2.displayName = 'Server2'

export default Server2
