// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUp33 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.25 4.00012L12.25 19.9999" stroke="currentColor"></path>
<path d="M6.58995 9.66028C9.4997 9.66028 12.25 7.0977 12.25 4.00023" stroke="currentColor"></path>
<path d="M17.91 9.66028C15.0003 9.66028 12.25 7.0977 12.25 4.00023" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowUp33.displayName = 'ArrowUp33'

export default ArrowUp33
