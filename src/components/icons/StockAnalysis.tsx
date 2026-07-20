// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const StockAnalysis = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.25 3.00049V5.00049" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.0152 5.00049H4.48376C3.66453 5.00049 3 5.66249 3 6.47958V9.52237C3 10.3395 3.66453 11.0005 4.48376 11.0005H6.0152C6.83541 11.0005 7.49994 10.3395 7.49994 9.52237V6.47958C7.49994 5.66249 6.83541 5.00049 6.0152 5.00049Z" stroke="currentColor"></path>
<path d="M5.25 11.0005V13.0005" stroke="currentColor"></path>
<path d="M12 6.00049V8.50049" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.7652 8.50049H11.2338C10.4145 8.50049 9.75 9.16249 9.75 9.97958V17.0224C9.75 17.8395 10.4145 18.5005 11.2338 18.5005H12.7652C13.5854 18.5005 14.2499 17.8395 14.2499 17.0224V9.97958C14.2499 9.16249 13.5854 8.50049 12.7652 8.50049Z" stroke="currentColor"></path>
<path d="M12 18.5005V21.0005" stroke="currentColor"></path>
<path d="M18.75 5.00049V7.50049" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.5152 7.50049H17.9838C17.1645 7.50049 16.5 8.16249 16.5 8.97958V9.02237C16.5 9.83945 17.1645 10.5005 17.9838 10.5005H19.5152C20.3354 10.5005 20.9999 9.83945 20.9999 9.02237V8.97958C20.9999 8.16249 20.3354 7.50049 19.5152 7.50049Z" stroke="currentColor"></path>
<path d="M18.75 10.5005V13.0005" stroke="currentColor"></path>
    </svg>
  ),
)

StockAnalysis.displayName = 'StockAnalysis'

export default StockAnalysis
