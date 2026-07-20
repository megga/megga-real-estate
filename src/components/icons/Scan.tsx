// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scan = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Scan" stroke="none" fill="none" fillRule="evenodd"> <g id="Scan" transform="translate(1.500000, 3.350100)" stroke="currentColor"> <line x1="21" y1="9.4555" x2="0" y2="9.4555" id="Stroke-1"></line> <path d="M19.1299,5.245 L19.1299,3.732 C19.1299,1.671 17.4589,1.77635684e-15 15.3969,1.77635684e-15 L14.1919,1.77635684e-15" id="Stroke-3"></path> <path d="M1.8701,5.245 L1.8701,3.732 C1.8701,1.671 3.5411,1.77635684e-15 5.6031,1.77635684e-15 L6.8391,1.77635684e-15" id="Stroke-5"></path> <path d="M19.1299,9.4545 L19.1299,13.5285 C19.1299,15.5905 17.4589,17.2615 15.3969,17.2615 L14.1919,17.2615" id="Stroke-7"></path> <path d="M1.8701,9.4545 L1.8701,13.5285 C1.8701,15.5905 3.5411,17.2615 5.6031,17.2615 L6.8391,17.2615" id="Stroke-9"></path> </g> </g>
    </svg>
  ),
)

Scan.displayName = 'Scan'

export default Scan
