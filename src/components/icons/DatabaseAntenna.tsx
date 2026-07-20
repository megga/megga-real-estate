// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseAntenna = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.5503 9.08962C14.7008 9.08962 18.0655 7.73231 18.0655 6.05799C18.0655 4.38367 14.7008 3.02637 10.5503 3.02637C6.39978 3.02637 3.03516 4.38367 3.03516 6.05799C3.03516 7.73231 6.39978 9.08962 10.5503 9.08962Z" stroke="currentColor"></path>
<path d="M3.03516 11.9697V17.9321C3.03516 17.9321 3.03516 20.9133 10.5668 20.9133" stroke="currentColor"></path>
<path d="M18.0668 11.9702V6.00781" stroke="currentColor"></path>
<path d="M3.03516 6.00781V11.9702C3.03516 11.9702 3.03516 14.9513 10.5668 14.9513" stroke="currentColor"></path>
<path d="M14.4984 20.9731V18.9854" stroke="currentColor"></path>
<path d="M17.4808 20.9736V16.999" stroke="currentColor"></path>
<path d="M20.4613 20.9731V15.0107" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseAntenna.displayName = 'DatabaseAntenna'

export default DatabaseAntenna
