// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VdeoTv = forwardRef<SVGSVGElement, Props>(
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
<path d="M7.50391 20.3438H16.4942" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.0685 11.3277C13.4224 11.9125 12.6158 12.4389 11.7275 12.7969C10.9725 13.0947 10.3391 12.723 10.2457 11.9777C10.1328 10.8802 10.1357 9.8284 10.2457 8.84764C10.3478 8.07413 11.0445 7.74526 11.7275 8.03229C12.6022 8.39034 13.3864 8.87683 14.0685 9.50148C14.6513 10.0298 14.6649 10.78 14.0685 11.3277Z" stroke="currentColor"></path>
    </svg>
  ),
)

VdeoTv.displayName = 'VdeoTv'

export default VdeoTv
