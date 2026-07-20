// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Unlock2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M7.69025 9.83644V7.90505V7.88505C7.70125 5.37105 9.74725 3.34305 12.2602 3.35405C13.5691 3.35405 14.7491 3.90689 15.5794 4.79175" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.1131 14.8066V17.0276" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.8625 21.854L19.8625 9.98047L4.63751 9.98047L4.63751 21.854L19.8625 21.854Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Unlock2.displayName = 'Unlock2'

export default Unlock2
