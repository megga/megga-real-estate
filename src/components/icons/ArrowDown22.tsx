// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDown22 = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Arrow---Down-2" stroke="none" fill="none" fillRule="evenodd"> <g id="Arrow---Down-2" transform="translate(5.000000, 8.500000)" stroke="currentColor"> <polyline id="Stroke-1" points="14 0 7 7 0 0"></polyline> </g> </g>
    </svg>
  ),
)

ArrowDown22.displayName = 'ArrowDown22'

export default ArrowDown22
