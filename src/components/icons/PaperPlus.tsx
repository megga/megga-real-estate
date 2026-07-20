// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperPlus = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Paper-Plus" stroke="none" fill="none" fillRule="evenodd"> <g id="Paper-Plus" transform="translate(3.500000, 2.000000)" stroke="currentColor"> <path d="M11.2366,0.761871154 L4.5846,0.761871154 C2.5046,0.7539 0.7996,2.4109 0.7506,4.4909 L0.7506,15.3399 C0.7156,17.3899 2.3486,19.0809 4.3996,19.1169 C4.4606,19.1169 4.5226,19.1169 4.5846,19.1149 L12.5726,19.1149 C14.6416,19.0939 16.3056,17.4089 16.3026041,15.3399 L16.3026041,6.0399 L11.2366,0.761871154 Z" id="Stroke-1"></path> <path d="M10.9743,0.7501 L10.9743,3.6591 C10.9743,5.0791 12.1233,6.2301 13.5433,6.2341 L16.2973,6.2341" id="Stroke-3"></path> <line x1="10.7937" y1="10.9142" x2="5.8937" y2="10.9142" id="Stroke-5"></line> <line x1="8.3445" y1="13.3639" x2="8.3445" y2="8.4639" id="Stroke-7"></line> </g> </g>
    </svg>
  ),
)

PaperPlus.displayName = 'PaperPlus'

export default PaperPlus
