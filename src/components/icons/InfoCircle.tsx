// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const InfoCircle = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Info-Square" stroke="none" fill="none" fillRule="evenodd"> <g id="Info-Square" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M14.3341,0.7501 L5.6651,0.7501 C2.6441,0.7501 0.7501,2.8891 0.7501,5.9161 L0.7501,14.0841 C0.7501,17.1111 2.6351,19.2501 5.6651,19.2501 L14.3331,19.2501 C17.3641,19.2501 19.2501,17.1111 19.2501,14.0841 L19.2501,5.9161 C19.2501,2.8891 17.3641,0.7501 14.3341,0.7501 Z" id="Stroke-1"></path> <line x1="9.9947" y1="14.0001" x2="9.9947" y2="10.0001" id="Stroke-3"></line> <line x1="9.9899" y1="6.2043" x2="9.9999" y2="6.2043" id="Stroke-2"></line> </g> </g>
    </svg>
  ),
)

InfoCircle.displayName = 'InfoCircle'

export default InfoCircle
