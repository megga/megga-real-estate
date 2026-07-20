// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoreCircle = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/More-Circle" stroke="none" fill="none" fillRule="evenodd"> <g id="More-Circle" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M10.0002,0.7501 C15.1082,0.7501 19.2502,4.8911 19.2502,10.0001 C19.2502,15.1081 15.1082,19.2501 10.0002,19.2501 C4.8912,19.2501 0.7502,15.1081 0.7502,10.0001 C0.7502,4.8921 4.8922,0.7501 10.0002,0.7501 Z" id="Stroke-1"></path> <line x1="13.9394" y1="10.013" x2="13.9484" y2="10.013" id="Stroke-11"></line> <line x1="9.9304" y1="10.013" x2="9.9394" y2="10.013" id="Stroke-13"></line> <line x1="5.9214" y1="10.013" x2="5.9304" y2="10.013" id="Stroke-15"></line> </g> </g>
    </svg>
  ),
)

MoreCircle.displayName = 'MoreCircle'

export default MoreCircle
