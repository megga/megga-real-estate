// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Movie2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.0077 21H7.99503C5.19484 21 3.45117 19.0234 3.45117 16.2251V7.77583C3.45117 4.97758 5.19484 3 7.99601 3H16.0077C18.8089 3 20.5506 4.97758 20.5506 7.77583V16.2251C20.5506 19.0234 18.8001 21 16.0077 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4392 17.2985H13.2628C12.4724 17.2985 11.832 16.6581 11.832 15.8677V14.5519C11.832 13.7614 12.4724 13.1211 13.2628 13.1211H15.4392C16.2297 13.1211 16.87 13.7614 16.87 14.5519V15.8677C16.87 16.6581 16.2297 17.2985 15.4392 17.2985Z" stroke="currentColor"></path>
<path d="M9.02344 7.47563V3M14.9766 7.47563V3" stroke="currentColor"></path>
<path d="M3.45703 7.47656H20.5428" stroke="currentColor"></path>
    </svg>
  ),
)

Movie2.displayName = 'Movie2'

export default Movie2
