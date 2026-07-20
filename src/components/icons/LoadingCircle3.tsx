// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoadingCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.80955 18.5879L5.80371 18.5976" stroke="currentColor"></path>
<path d="M3.32224 14.7959L3.31641 14.8056" stroke="currentColor"></path>
<path d="M3.08006 10.2256L3.07422 10.2353" stroke="currentColor"></path>
<path d="M5.12498 6.08008L5.11914 6.08981" stroke="currentColor"></path>
<path d="M8.94138 3.47852L8.93555 3.48825" stroke="currentColor"></path>
<path d="M11.9411 3C16.9121 3.00681 20.9353 7.04173 20.9285 12.0126C20.9217 16.9836 16.8868 21.0068 11.9159 21C10.7804 20.998 9.69456 20.7869 8.69531 20.4016" stroke="currentColor"></path>
    </svg>
  ),
)

LoadingCircle3.displayName = 'LoadingCircle3'

export default LoadingCircle3
