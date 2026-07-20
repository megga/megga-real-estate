// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PyramidChart2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M20.2441 19.8105C20.0152 19.9065 19.663 19.9065 18.9584 19.9065H5.04156C4.33703 19.9065 3.98477 19.9065 3.75589 19.8105C3.24657 19.597 2.94155 19.0712 3.00939 18.5236C3.03987 18.2775 3.21504 17.9722 3.56538 17.3616L3.8768 16.8188L20.1232 16.8188L20.4346 17.3616C20.7849 17.9722 20.9601 18.2775 20.9906 18.5236C21.0584 19.0712 20.7534 19.597 20.2441 19.8105Z" stroke="currentColor"></path>
<path d="M8.43262 8.64435L10.5237 5.23441C10.8777 4.61749 11.2107 4.07331 12.0331 4.09538C12.818 4.11643 13.1335 4.6374 13.4761 5.2344L15.5341 8.64435H8.43262Z" stroke="currentColor"></path>
<path d="M5.12695 14.3188L18.8807 14.3188L16.9216 10.9814L7.07881 10.9814L5.12695 14.3188Z" stroke="currentColor"></path>
    </svg>
  ),
)

PyramidChart2.displayName = 'PyramidChart2'

export default PyramidChart2
