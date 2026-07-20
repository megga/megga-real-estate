// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TimeSquare = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Time-Square" stroke="none" fill="none" fillRule="evenodd"> <g id="Time-Square" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M14.3347,0.7502 L5.6657,0.7502 C2.6447,0.7502 0.7507,2.8892 0.7507,5.9162 L0.7507,14.0842 C0.7507,17.1112 2.6347,19.2502 5.6657,19.2502 L14.3337,19.2502 C17.3647,19.2502 19.2507,17.1112 19.2507,14.0842 L19.2507,5.9162 C19.2507,2.8892 17.3647,0.7502 14.3347,0.7502 Z" id="Stroke-1"></path> <polyline id="Stroke-3" points="13.3913 12.0177 10.0003 9.9947 10.0003 5.6337"></polyline> </g> </g>
    </svg>
  ),
)

TimeSquare.displayName = 'TimeSquare'

export default TimeSquare
