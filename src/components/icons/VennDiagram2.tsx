// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VennDiagram2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <circle cx="8.59287" cy="14.829" r="5.59287" stroke="currentColor"></circle>
<circle cx="15.4073" cy="14.829" r="5.59287" stroke="currentColor"></circle>
<ellipse cx="11.8715" cy="9.17197" rx="5.65716" ry="5.59287" stroke="currentColor"></ellipse>
    </svg>
  ),
)

VennDiagram2.displayName = 'VennDiagram2'

export default VennDiagram2
