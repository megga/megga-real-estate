// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Icon4KDisplay = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.50391 20.3438H16.4942" stroke="currentColor"></path>
<path d="M7.02811 3.65625H16.9709C19.1961 3.65625 21 5.46014 21 7.68533V13.1418C21 15.367 19.1961 17.1708 16.9709 17.1708H7.02811C4.80389 17.1708 3 15.367 3 13.1418V7.68533C3 5.46014 4.80389 3.65625 7.02811 3.65625Z" stroke="currentColor"></path>
<path d="M9.82869 12.8967V11.7651M9.82869 11.7651H10.7871M9.82869 11.7651H7.07031L9.82869 7.92969V11.7651Z" stroke="currentColor"></path>
<path d="M13.0469 8.08594V12.7367" stroke="currentColor"></path>
<path d="M16.1907 8.25391L13.6172 10.412L16.1907 12.57" stroke="currentColor"></path>
    </svg>
  ),
)

Icon4KDisplay.displayName = 'Icon4KDisplay'

export default Icon4KDisplay
