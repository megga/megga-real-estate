// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperNegative = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Paper-Negative" stroke="none" fill="none" fillRule="evenodd"> <g id="Paper-Negative" transform="translate(3.500000, 2.000000)" stroke="currentColor"> <path d="M11.2365,0.761863533 L4.5845,0.761863533 C2.5045,0.7529 0.7995,2.4109 0.7505,4.4909 L0.7505,15.3399 C0.7155,17.3899 2.3485,19.0809 4.3995,19.1169 C4.4605,19.1169 4.5225,19.1169 4.5845,19.1149 L12.5725,19.1149 C14.6415,19.0939 16.3055,17.4089 16.3025041,15.3399 L16.3025041,6.0399 L11.2365,0.761863533 Z" id="Stroke-1"></path> <path d="M10.9733,0.7501 L10.9733,3.6591 C10.9733,5.0791 12.1223,6.2301 13.5423,6.2341 L16.2963,6.2341" id="Stroke-3"></path> <line x1="10.7927" y1="11.7472" x2="5.8927" y2="11.7472" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

PaperNegative.displayName = 'PaperNegative'

export default PaperNegative
