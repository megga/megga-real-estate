// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VennDiagram3 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="8.74042" cy="12.1481" r="5.74042" stroke="currentColor"></circle>
<circle cx="15.2595" cy="12.1481" r="5.74042" stroke="currentColor"></circle>
    </svg>
  ),
)

VennDiagram3.displayName = 'VennDiagram3'

export default VennDiagram3
