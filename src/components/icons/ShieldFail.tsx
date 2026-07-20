// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldFail = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Shield-Fail" stroke="none" fill="none" fillRule="evenodd"> <g id="Shield-Fail" transform="translate(3.500000, 2.000000)" stroke="currentColor"> <path d="M8.485,19.606 C8.485,19.606 16.157,17.283 16.157,10.879 C16.157,4.474 16.435,3.974 15.819,3.358 C15.204,2.742 9.491,0.75 8.485,0.75 C7.479,0.75 1.766,2.742 1.15,3.358 C0.535,3.974 0.813,4.474 0.813,10.879 C0.813,17.283 8.485,19.606 8.485,19.606 Z" id="Stroke-1"></path> <line x1="10.3639" y1="11.8248" x2="6.6059" y2="8.0668" id="Stroke-3"></line> <line x1="6.606" y1="11.8248" x2="10.364" y2="8.0668" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

ShieldFail.displayName = 'ShieldFail'

export default ShieldFail
