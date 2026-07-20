// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Logout22 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.0493 16.7637L13.0493 21.3887L2.5254 21.3887L2.5254 2.88867L13.0493 2.88867L13.0493 7.51367" stroke="currentColor"></path>
<path d="M21.9746 12.1396L8.03535 12.1396" stroke="currentColor"></path>
<path d="M17.3789 7.54414C17.3789 9.90662 19.4595 12.1396 21.9744 12.1396" stroke="currentColor"></path>
<path d="M17.3789 16.7352C17.3789 14.3727 19.4595 12.1396 21.9744 12.1396" stroke="currentColor"></path>
    </svg>
  ),
)

Logout22.displayName = 'Logout22'

export default Logout22
