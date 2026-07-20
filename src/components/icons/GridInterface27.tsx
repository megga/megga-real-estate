// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface27 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.0417 4.91602H7.27331C4.64725 4.91602 3 6.77537 3 9.40728V16.5081C3 19.14 4.63849 20.9993 7.27331 20.9993H14.809C17.4448 20.9993 19.0833 19.14 19.0833 16.5081V12.9577" stroke="currentColor"></path>
<path d="M19.0833 12.9574L3 12.957" stroke="currentColor"></path>
<path d="M11.041 4.91602L11.0411 20.9993" stroke="currentColor"></path>
<path d="M20.9993 6.94931V10.0716H13.9277V3H17.2417C19.5583 3 20.9993 4.6346 20.9993 6.94931Z" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface27.displayName = 'GridInterface27'

export default GridInterface27
