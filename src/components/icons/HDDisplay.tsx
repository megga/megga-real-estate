// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HDDisplay = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.02811 3.65625H16.9709C19.1961 3.65625 21 5.46014 21 7.68533V13.1418C21 15.367 19.1961 17.1708 16.9709 17.1708H7.02811C4.80389 17.1708 3 15.367 3 13.1418V7.68533C3 5.46014 4.80389 3.65625 7.02811 3.65625Z" stroke="currentColor"></path>
<path d="M7.50391 20.3438H16.4951" stroke="currentColor"></path>
<path d="M7.7832 8.03516V13.0255M7.7832 10.5303H11.1098M11.1102 8.03516V13.0255" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.4374 13.0255H13.6055V8.03516H14.4374C15.8151 8.03516 16.9321 9.15213 16.9321 10.5299C16.9321 11.9086 15.8151 13.0255 14.4374 13.0255Z" stroke="currentColor"></path>
    </svg>
  ),
)

HDDisplay.displayName = 'HDDisplay'

export default HDDisplay
