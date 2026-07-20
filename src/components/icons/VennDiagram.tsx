// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VennDiagram = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="7.50047" r="4.49999" stroke="currentColor"></circle>
<circle cx="12" cy="16.5005" r="4.49999" stroke="currentColor"></circle>
<circle cx="16.5" cy="12.0006" r="4.49999" transform="rotate(90 16.5 12.0006)" stroke="currentColor"></circle>
<circle cx="7.50001" cy="12.0004" r="4.49999" transform="rotate(90 7.50001 12.0004)" stroke="currentColor"></circle>
    </svg>
  ),
)

VennDiagram.displayName = 'VennDiagram'

export default VennDiagram
