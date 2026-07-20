// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseCheck = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.0107 18.9349L16.0049 20.928L20.4212 16.5117" stroke="currentColor"></path>
<path d="M3.57812 5.88965V11.6695C3.57812 11.6695 3.57812 14.5593 10.8791 14.5593C18.18 14.5593 18.18 11.6695 18.18 11.6695V5.88965" stroke="currentColor"></path>
<path d="M3.57812 11.6699V17.4497C3.57812 17.4497 3.57812 20.3405 10.8791 20.3405" stroke="currentColor"></path>
<ellipse cx="10.8791" cy="5.9082" rx="7.30095" ry="2.9082" stroke="currentColor"></ellipse>
    </svg>
  ),
)

DatabaseCheck.displayName = 'DatabaseCheck'

export default DatabaseCheck
