// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoadingCircle4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.4082 21L10.418 20.9951" stroke="currentColor"></path>
<path d="M15.0469 20.6173L15.0528 20.6074" stroke="currentColor"></path>
<path d="M5.78715 18.6621L5.78125 18.6719" stroke="currentColor"></path>
<path d="M18.9062 17.9854L18.9122 17.9756" stroke="currentColor"></path>
<path d="M8.95219 3.38379L8.94629 3.39363" stroke="currentColor"></path>
<path d="M5.09379 6.01465L5.08789 6.02449" stroke="currentColor"></path>
<path d="M18.2119 5.33796L18.2178 5.32812" stroke="currentColor"></path>
<path d="M13.5919 3L13.582 3.00492" stroke="currentColor"></path>
<path d="M20.7295 9.17292L20.7354 9.16309" stroke="currentColor"></path>
<path d="M3.02543 10.2061L3.01953 10.2159" stroke="currentColor"></path>
<path d="M3.27153 14.8281L3.26562 14.838" stroke="currentColor"></path>
<path d="M20.9746 13.793L20.9805 13.7832" stroke="currentColor"></path>
    </svg>
  ),
)

LoadingCircle4.displayName = 'LoadingCircle4'

export default LoadingCircle4
