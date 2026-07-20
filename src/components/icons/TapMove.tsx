// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TapMove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.4424 12.4299C18.3218 14.8038 17.4566 17.9448 15.9155 19.4859C13.9492 21.4522 8.45428 21.6016 6.65529 19.3645C5.51367 17.9448 4.62637 16.2219 4.06706 14.6781C3.76709 13.8501 4.20727 12.9572 5.02949 12.6419C5.75733 12.3627 6.58167 12.6182 7.02406 13.26L8.1288 14.8628V6.00512C8.1288 5.15229 8.82015 4.46094 9.67298 4.46094C10.5166 4.46094 11.204 5.13792 11.217 5.98141L11.2783 9.97641C13.4394 10.1828 16.5686 10.0713 17.4424 12.4299Z" stroke="currentColor"></path>
<path d="M15.0234 5.08594L14.1895 5.91988L15.0234 6.75389" stroke="currentColor"></path>
<path d="M16.2734 8.00391L17.1074 8.83787L17.9414 8.00391" stroke="currentColor"></path>
<path d="M16.2734 3.83398L17.1074 3L17.9414 3.83398" stroke="currentColor"></path>
<path d="M19.1934 5.08594L20.0273 5.91988L19.1934 6.75389" stroke="currentColor"></path>
<path d="M20.0273 5.91797H14.1895" stroke="currentColor"></path>
<path d="M17.1074 3V8.83784" stroke="currentColor"></path>
    </svg>
  ),
)

TapMove.displayName = 'TapMove'

export default TapMove
