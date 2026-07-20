// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Danger = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Danger-Circle" stroke="none" fill="none" fillRule="evenodd"> <g id="Danger-Circle" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <path d="M10.0001,0.7501 C15.1081,0.7501 19.2501,4.8911 19.2501,10.0001 C19.2501,15.1081 15.1081,19.2501 10.0001,19.2501 C4.8911,19.2501 0.7501,15.1081 0.7501,10.0001 C0.7501,4.8911 4.8911,0.7501 10.0001,0.7501 Z" id="Stroke-1"></path> <line x1="9.9952" y1="6.2042" x2="9.9952" y2="10.6232" id="Stroke-3"></line> <line x1="9.995" y1="13.7961" x2="10.005" y2="13.7961" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

Danger.displayName = 'Danger'

export default Danger
