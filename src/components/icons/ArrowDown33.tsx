// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDown33 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M12.25 19.9998L12.25 3.99999" stroke="currentColor"></path>
<path d="M6.58995 14.34C9.4997 14.34 12.25 16.9025 12.25 20" stroke="currentColor"></path>
<path d="M17.91 14.34C15.0003 14.34 12.25 16.9025 12.25 20" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDown33.displayName = 'ArrowDown33'

export default ArrowDown33
