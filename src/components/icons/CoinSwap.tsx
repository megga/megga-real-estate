// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CoinSwap = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.00195 16.9905C3.00195 19.2049 4.79704 21 7.01151 21C9.22599 21 11.0221 19.2049 11.0221 16.9905C11.0221 14.776 9.22599 12.9809 7.01151 12.9809C4.79704 12.9809 3.00195 14.776 3.00195 16.9905Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.9967 7.00956C20.9967 4.79508 19.2016 3 16.9871 3C14.7727 3 12.9766 4.79508 12.9766 7.00956C12.9766 9.22403 14.7727 11.0191 16.9871 11.0191C19.2016 11.0191 20.9967 9.22403 20.9967 7.00956Z" stroke="currentColor"></path>
<path d="M3.00195 8.39335C3.00195 5.41506 5.41701 3 8.39531 3L7.75507 4.72316" stroke="currentColor"></path>
<path d="M20.9969 15.5449C20.9969 18.5232 18.5818 20.9383 15.6035 20.9383L16.2437 19.2151" stroke="currentColor"></path>
    </svg>
  ),
)

CoinSwap.displayName = 'CoinSwap'

export default CoinSwap
