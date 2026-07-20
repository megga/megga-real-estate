// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Restart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.3646 5.63672L16.6434 7.3579M5.63672 18.3647L7.3579 16.6425M18.3646 18.3647L16.6434 16.6425M5.63672 5.63672L7.3579 7.3579" stroke="currentColor"></path>
<path d="M12 3V5.43437M12 21V18.5656M21 12H18.5656M3 12H5.43437" stroke="currentColor"></path>
    </svg>
  ),
)

Restart2.displayName = 'Restart2'

export default Restart2
