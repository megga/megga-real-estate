// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Danger22 = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Danger-Triangle" stroke="none" fill="none" fillRule="evenodd"> <g id="Danger-Triangle" transform="translate(2.000000, 3.000000)" stroke="currentColor"> <path d="M2.814,17.4368 L17.197,17.4368 C18.779,17.4368 19.772,15.7268 18.986,14.3528 L11.8,1.7878 C11.009,0.4048 9.015,0.4038 8.223,1.7868 L1.025,14.3518 C0.239,15.7258 1.231,17.4368 2.814,17.4368 Z" id="Stroke-1"></path> <line x1="10.0025" y1="10.4148" x2="10.0025" y2="7.3148" id="Stroke-3"></line> <line x1="9.995" y1="13.5" x2="10.005" y2="13.5" id="Stroke-2"></line> </g> </g>
    </svg>
  ),
)

Danger22.displayName = 'Danger22'

export default Danger22
