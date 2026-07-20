// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Roadmap = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12 21.001L12 3.00098" stroke="currentColor"></path>
<circle cx="5.39551" cy="12.0386" r="2" transform="rotate(-90 5.39551 12.0386)" stroke="currentColor"></circle>
<path d="M10.5273 12.0386L11.9998 12.0386" stroke="currentColor"></path>
<path d="M7.39551 12.0386L8.59985 12.0386" stroke="currentColor"></path>
<circle cx="2" cy="2" r="2" transform="matrix(-6.79865e-09 -1 -1 6.79865e-09 20.6045 8.86328)" stroke="currentColor"></circle>
<path d="M13.4727 6.86328L12.0002 6.86328" stroke="currentColor"></path>
<path d="M16.6045 6.86328L15.4001 6.86328" stroke="currentColor"></path>
<circle cx="2" cy="2" r="2" transform="matrix(-6.79865e-09 -1 -1 6.79865e-09 20.6045 19.1387)" stroke="currentColor"></circle>
<path d="M13.4727 17.1387L12.0002 17.1387" stroke="currentColor"></path>
<path d="M16.6045 17.1387L15.4001 17.1387" stroke="currentColor"></path>
    </svg>
  ),
)

Roadmap.displayName = 'Roadmap'

export default Roadmap
