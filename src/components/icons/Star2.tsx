// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Star2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.25 2.88867V21.3887" stroke="currentColor"></path>
<path d="M21.5 12.1387L3 12.1387" stroke="currentColor"></path>
<path d="M18.791 5.59814L5.70954 18.6796" stroke="currentColor"></path>
<path d="M18.791 18.6792L5.70954 5.59772" stroke="currentColor"></path>
    </svg>
  ),
)

Star2.displayName = 'Star2'

export default Star2
