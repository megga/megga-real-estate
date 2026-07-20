// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Loading = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.35742 17.5027L7.07861 15.7805M18.0853 17.5027L16.3642 15.7805M6.12962 5.54695L7.07861 6.49591" stroke="currentColor"></path>
<path d="M11.7206 3.8594V4.57718M11.7206 20.1428V17.7084M20.7206 11.1428H18.2863M3.2793 11.1428H5.155" stroke="currentColor"></path>
    </svg>
  ),
)

Loading.displayName = 'Loading'

export default Loading
