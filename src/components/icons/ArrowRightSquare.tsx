// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightSquare = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Arrow---Right-Square" stroke="none" fill="none" fillRule="evenodd"> <g id="Arrow---Right-Square" transform="translate(12.000000, 12.000000) rotate(-90.000000) translate(-12.000000, -12.000000) translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M5.6659,19.25 L14.3349,19.25 C17.3549,19.25 19.2499,17.111 19.2499,14.084 L19.2499,5.916 C19.2499,2.889 17.3649,0.75 14.3349,0.75 L5.6659,0.75 C2.6359,0.75 0.7499,2.889 0.7499,5.916 L0.7499,14.084 C0.7499,17.111 2.6359,19.25 5.6659,19.25 Z" id="Stroke-1"></path> <line x1="9.9999" y1="14.086" x2="9.9999" y2="5.914" id="Stroke-3"></line> <polyline id="Stroke-5" points="13.7479 10.3223 9.9999 14.0863 6.2519 10.3223"></polyline> </g> </g>
    </svg>
  ),
)

ArrowRightSquare.displayName = 'ArrowRightSquare'

export default ArrowRightSquare
