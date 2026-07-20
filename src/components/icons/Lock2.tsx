// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lock2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.8112 9.83644V7.90505C16.8112 5.39205 14.7732 3.35405 12.2602 3.35405C9.74725 3.34305 7.70125 5.37105 7.69025 7.88505V7.90505V9.83644" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.1131 14.8066V17.0276" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.8625 21.854L19.8625 9.98047L4.63751 9.98047L4.63751 21.854L19.8625 21.854Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Lock2.displayName = 'Lock2'

export default Lock2
