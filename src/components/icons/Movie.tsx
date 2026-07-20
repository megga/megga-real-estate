// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Movie = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.48246 3.5625H16.5156C19.2788 3.5625 20.999 5.51279 20.999 8.274V15.7243C20.999 18.4845 19.2788 20.4358 16.5146 20.4358H7.48246C4.71832 20.4358 3 18.4845 3 15.7243V8.274C3 5.51279 4.7271 3.5625 7.48246 3.5625Z" stroke="currentColor"></path>
<path d="M3 8.5H21" stroke="currentColor"></path>
<path d="M8.24455 8.49612L5.95508 3.79437M12.6863 8.49623L10.2692 3.56641M17.137 8.49623L14.7199 3.56641" stroke="currentColor"></path>
    </svg>
  ),
)

Movie.displayName = 'Movie'

export default Movie
