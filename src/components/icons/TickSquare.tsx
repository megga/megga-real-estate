// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TickSquare = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Tick-Square" stroke="none" fill="none" fillRule="evenodd"> <g id="Tick-Square" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M14.3344,0.7502 L5.6654,0.7502 C2.6444,0.7502 0.7504,2.8892 0.7504,5.9162 L0.7504,14.0842 C0.7504,17.1112 2.6354,19.2502 5.6654,19.2502 L14.3334,19.2502 C17.3644,19.2502 19.2504,17.1112 19.2504,14.0842 L19.2504,5.9162 C19.2504,2.8892 17.3644,0.7502 14.3344,0.7502 Z" id="Stroke-1"></path> <polyline id="Stroke-3" points="6.4399 10.0002 8.8139 12.3732 13.5599 7.6272"></polyline> </g> </g>
    </svg>
  ),
)

TickSquare.displayName = 'TickSquare'

export default TickSquare
