// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter11 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.7292 17.5762H3.50586" stroke="currentColor"></path>
<path d="M13.2715 6.41602H20.4948" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.66021 6.29745C8.66021 7.8602 7.39269 9.1281 5.83065 9.1281C4.26752 9.1281 3 7.8602 3 6.29745C3 4.73469 4.26752 3.4668 5.83065 3.4668C7.39269 3.4668 8.66021 4.73469 8.66021 6.29745Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.3398 17.7037C15.3398 16.1409 16.6063 14.873 18.1694 14.873C19.7325 14.873 21.0001 16.1409 21.0001 17.7037C21.0001 19.2665 19.7325 20.5344 18.1694 20.5344C16.6063 20.5344 15.3398 19.2665 15.3398 17.7037Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter11.displayName = 'Filter11'

export default Filter11
