// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Search = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Search" stroke="none" fill="none" fillRule="evenodd"> <g id="Search" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <circle id="Ellipse_739" cx="9.76659044" cy="9.76659044" r="8.9885584"></circle> <line x1="16.0183067" y1="16.4851259" x2="19.5423342" y2="20.0000001" id="Line_181"></line> </g> </g>
    </svg>
  ),
)

Search.displayName = 'Search'

export default Search
