// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUp32 = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Arrow---Up-3" stroke="none" fill="none" fillRule="evenodd"> <g id="Arrow---Up-3" transform="translate(12.000000, 12.000000) rotate(-180.000000) translate(-12.000000, -12.000000) translate(6.500000, 3.000000)" stroke="currentColor"> <line x1="5.7513" y1="9.6998" x2="5.7513" y2="0.7498" id="Stroke-1"></line> <polygon id="Stroke-3" points="0.7503 9.6998 5.7513 17.6368 10.7523 9.6998"></polygon> </g> </g>
    </svg>
  ),
)

ArrowUp32.displayName = 'ArrowUp32'

export default ArrowUp32
