// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scan2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M22.25 13.3201H2.25" stroke="currentColor"></path>
<path d="M20.4685 9.31006V4.31482H15.7656" stroke="currentColor"></path>
<path d="M4.03107 9.31006V4.31482H8.76345" stroke="currentColor"></path>
<path d="M20.4685 13.3192V20.7545H15.7656" stroke="currentColor"></path>
<path d="M4.03107 13.3192V20.7545H8.76345" stroke="currentColor"></path>
    </svg>
  ),
)

Scan2.displayName = 'Scan2'

export default Scan2
