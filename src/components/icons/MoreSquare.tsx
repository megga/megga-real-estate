// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoreSquare = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/More-Square" stroke="none" fill="none" fillRule="evenodd"> <g id="More-Square" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M14.3342,0.7501 L5.6652,0.7501 C2.6442,0.7501 0.7502,2.8891 0.7502,5.9161 L0.7502,14.0841 C0.7502,17.1111 2.6342,19.2501 5.6652,19.2501 L14.3332,19.2501 C17.3642,19.2501 19.2502,17.1111 19.2502,14.0841 L19.2502,5.9161 C19.2502,2.8891 17.3642,0.7501 14.3342,0.7501 Z" id="Stroke-1"></path> <line x1="13.9394" y1="10.013" x2="13.9484" y2="10.013" id="Stroke-11"></line> <line x1="9.9304" y1="10.013" x2="9.9394" y2="10.013" id="Stroke-13"></line> <line x1="5.9214" y1="10.013" x2="5.9304" y2="10.013" id="Stroke-15"></line> </g> </g>
    </svg>
  ),
)

MoreSquare.displayName = 'MoreSquare'

export default MoreSquare
