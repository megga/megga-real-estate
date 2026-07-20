// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface21 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.198 3H18.802C20.016 3 21 3.984 21 5.198V5.802C21 7.016 20.016 8 18.802 8H16.198C14.984 8 14 7.016 14 5.802V5.198C14 3.984 14.984 3 16.198 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.198 12H18.802C20.016 12 21 12.984 21 14.198V18.802C21 20.016 20.016 21 18.802 21H16.198C14.984 21 14 20.016 14 18.802V14.198C14 12.984 14.984 12 16.198 12Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.198 3H7.802C9.016 3 10 3.984 10 5.198V18.802C10 20.016 9.016 21 7.802 21H5.198C3.984 21 3 20.016 3 18.802V5.198C3 3.984 3.984 3 5.198 3Z" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface21.displayName = 'GridInterface21'

export default GridInterface21
