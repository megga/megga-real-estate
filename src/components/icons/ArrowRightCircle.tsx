// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightCircle = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Arrow---Right-Circle" stroke="none" fill="none" fillRule="evenodd"> <g id="Arrow---Right-Circle" transform="translate(12.000000, 12.000000) rotate(-90.000000) translate(-12.000000, -12.000000) translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M0.7502,10 C0.7502,15.108 4.8912,19.25 10.0002,19.25 C15.1082,19.25 19.2502,15.108 19.2502,10 C19.2502,4.892 15.1082,0.75 10.0002,0.75 C4.8912,0.75 0.7502,4.892 0.7502,10 Z" id="Stroke-1"></path> <polyline id="Stroke-3" points="6.529 8.5577 10 12.0437 13.471 8.5577"></polyline> </g> </g>
    </svg>
  ),
)

ArrowRightCircle.displayName = 'ArrowRightCircle'

export default ArrowRightCircle
