// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Airplay = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.9709 16.718C19.1961 16.718 21 14.9141 21 12.6889V7.23245C21 5.00726 19.1961 3.20337 16.9709 3.20337H7.02811C4.80389 3.20337 3 5.00726 3 7.23245V12.6889C3 14.9141 4.80389 16.718 7.02811 16.718" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.26216 20.7967H14.7361C15.3345 20.7967 15.7091 20.1507 15.4133 19.6321L12.6929 14.8587C12.3951 14.3352 11.643 14.3333 11.3424 14.8548L8.58789 19.6282C8.28822 20.1477 8.66281 20.7967 9.26216 20.7967Z" stroke="currentColor"></path>
    </svg>
  ),
)

Airplay.displayName = 'Airplay'

export default Airplay
