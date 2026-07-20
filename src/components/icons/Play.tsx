// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Play = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Play" stroke="none" fill="none" fillRule="evenodd"> <g id="Play" transform="translate(2.500000, 2.500000)" stroke="currentColor"> <path d="M9.5,0 C14.7459,0 19,4.25315 19,9.5 C19,14.74685 14.7459,19 9.5,19 C4.25315,19 0,14.74685 0,9.5 C0,4.25315 4.25315,0 9.5,0 Z" id="Stroke-1"></path> <path d="M12.5,9.49514457 C12.5,8.68401476 8.34252742,6.08911717 7.87091185,6.55569627 C7.39929629,7.02227536 7.35394864,11.9240477 7.87091185,12.4345929 C8.38787507,12.9469326 12.5,10.3062744 12.5,9.49514457 Z" id="Stroke-3"></path> </g> </g>
    </svg>
  ),
)

Play.displayName = 'Play'

export default Play
