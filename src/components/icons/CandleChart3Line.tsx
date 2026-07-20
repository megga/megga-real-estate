// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CandleChart3Line = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.25 3.00049V5.50049" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.0152 5.50049H4.48376C3.66453 5.50049 3 6.16249 3 6.97958V10.0224C3 10.8395 3.66453 11.5005 4.48376 11.5005H6.0152C6.83541 11.5005 7.49994 10.8395 7.49994 10.0224V6.97958C7.49994 6.16249 6.83541 5.50049 6.0152 5.50049Z" stroke="currentColor"></path>
<path d="M5.25 11.5005V14.0005" stroke="currentColor"></path>
<path d="M12 11.0005V13.5005" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.7652 13.5005H11.2338C10.4145 13.5005 9.75 14.1625 9.75 14.9796V17.0224C9.75 17.8395 10.4145 18.5005 11.2338 18.5005H12.7652C13.5854 18.5005 14.2499 17.8395 14.2499 17.0224V14.9796C14.2499 14.1625 13.5854 13.5005 12.7652 13.5005Z" stroke="currentColor"></path>
<path d="M12 18.5005V21.0005" stroke="currentColor"></path>
<path d="M18.75 3.00049V5.50049" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.5152 5.50049H17.9838C17.1645 5.50049 16.5 6.16249 16.5 6.97958V12.0224C16.5 12.8395 17.1645 13.5005 17.9838 13.5005H19.5152C20.3354 13.5005 20.9999 12.8395 20.9999 12.0224V6.97958C20.9999 6.16249 20.3354 5.50049 19.5152 5.50049Z" stroke="currentColor"></path>
<path d="M18.75 13.5005V16.0005" stroke="currentColor"></path>
    </svg>
  ),
)

CandleChart3Line.displayName = 'CandleChart3Line'

export default CandleChart3Line
