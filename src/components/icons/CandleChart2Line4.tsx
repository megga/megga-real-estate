// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CandleChart2Line4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.25 21.0005V17.5005" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.0152 17.5005H6.48376C5.66453 17.5005 5 16.8385 5 16.0214V7.97861C5 7.16152 5.66453 6.50049 6.48376 6.50049H8.0152C8.83541 6.50049 9.49994 7.16152 9.49994 7.97861V16.0214C9.49994 16.8385 8.83541 17.5005 8.0152 17.5005Z" stroke="currentColor"></path>
<path d="M7.25 6.50049V3.00049" stroke="currentColor"></path>
<path d="M16.75 19.0005V14.5005" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.5152 14.5005H15.9838C15.1645 14.5005 14.5 13.8385 14.5 13.0214V10.9786C14.5 10.1615 15.1645 9.50049 15.9838 9.50049H17.5152C18.3354 9.50049 18.9999 10.1615 18.9999 10.9786V13.0214C18.9999 13.8385 18.3354 14.5005 17.5152 14.5005Z" stroke="currentColor"></path>
<path d="M16.75 9.50049V5.00049" stroke="currentColor"></path>
    </svg>
  ),
)

CandleChart2Line4.displayName = 'CandleChart2Line4'

export default CandleChart2Line4
