// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface17 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.248 8.92285H14.75M14.7505 4.0918H20.2485" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.198 14H18.802C20.016 14 21 14.984 21 16.198V18.802C21 20.016 20.016 21 18.802 21H16.198C14.984 21 14 20.016 14 18.802V16.198C14 14.984 14.984 14 16.198 14Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.198 14H7.802C9.016 14 10 14.984 10 16.198V18.802C10 20.016 9.016 21 7.802 21H5.198C3.984 21 3 20.016 3 18.802V16.198C3 14.984 3.984 14 5.198 14Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.198 3H7.802C9.016 3 10 3.984 10 5.198V7.802C10 9.016 9.016 10 7.802 10H5.198C3.984 10 3 9.016 3 7.802V5.198C3 3.984 3.984 3 5.198 3Z" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface17.displayName = 'GridInterface17'

export default GridInterface17
