// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Discovery = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Discovery" stroke="none" fill="none" fillRule="evenodd"> <g id="Discovery" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <polygon id="Path_33947" points="6.27002291 12.9519451 7.86270027 7.86270027 12.9519451 6.27002291 11.3592678 11.3592678"></polygon> <circle id="Ellipse_738" cx="9.61098403" cy="9.61098403" r="9.61098403"></circle> </g> </g>
    </svg>
  ),
)

Discovery.displayName = 'Discovery'

export default Discovery
