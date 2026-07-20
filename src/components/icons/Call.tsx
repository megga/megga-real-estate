// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Call = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Call" stroke="none" fill="none" fillRule="evenodd"> <g id="Call" transform="translate(2.500000, 2.500000)" stroke="currentColor"> <path d="M9.03174073,9.97238745 C13.0208243,13.9603606 13.9257751,9.34671782 16.4656491,11.8848116 C18.9142765,14.3327574 20.32162,14.8232052 17.2192381,17.9247236 C16.8306352,18.2370218 14.3616115,21.9942591 5.68460336,13.3196663 C-2.99347825,4.64400029 0.761584769,2.17244427 1.07396994,1.78394958 C4.18386634,-1.32615434 4.6658627,0.0893829491 7.11449014,2.53732879 C9.6543641,5.07649576 5.04265719,5.9844143 9.03174073,9.97238745 Z" id="Stroke-1"></path> </g> </g>
    </svg>
  ),
)

Call.displayName = 'Call'

export default Call
