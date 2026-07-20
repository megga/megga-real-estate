// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeft32 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M4.25012 12L20.2499 12" stroke="currentColor"></path>
<path d="M9.91028 6.33995C9.91028 9.2497 7.3477 12 4.25023 12" stroke="currentColor"></path>
<path d="M9.91028 17.66C9.91028 14.7503 7.3477 12 4.25023 12" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowLeft32.displayName = 'ArrowLeft32'

export default ArrowLeft32
