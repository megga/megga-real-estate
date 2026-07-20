// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CutTweezers = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.38486 9.6955C8.68134 9.6955 9.73261 8.64423 9.73261 7.34775C9.73261 6.05127 8.68134 5 7.38486 5C6.08838 5 5.03711 6.05127 5.03711 7.34775C5.03711 8.64423 6.08838 9.6955 7.38486 9.6955Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.38486 14.3045C8.68134 14.3045 9.73261 15.3558 9.73261 16.6523C9.73261 17.9487 8.68134 19 7.38486 19C6.08838 19 5.03711 17.9487 5.03711 16.6523C5.03711 15.3558 6.08838 14.3045 7.38486 14.3045Z" stroke="currentColor"></path>
<path d="M18.9642 17.8419L9.2168 8.80469" stroke="currentColor"></path>
<path d="M18.9642 6.15625L9.2168 15.1934" stroke="currentColor"></path>
    </svg>
  ),
)

CutTweezers.displayName = 'CutTweezers'

export default CutTweezers
