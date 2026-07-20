// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface10 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9996 7.78178V16.2158C20.9996 19.1637 18.9185 20.9986 15.9736 20.9986H8.02696C5.082 20.9986 3.00098 19.1637 3.00098 16.2148V7.78178C3.00098 4.83391 5.082 3 8.02696 3H15.9736C18.9185 3 20.9996 4.84266 20.9996 7.78178Z" stroke="currentColor"></path>
<path d="M20.9898 15.0309H3M20.9898 8.98828H3" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface10.displayName = 'GridInterface10'

export default GridInterface10
