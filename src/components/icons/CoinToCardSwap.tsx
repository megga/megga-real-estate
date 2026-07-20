// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CoinToCardSwap = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.4483 12.7224H5.10423C3.81117 12.7224 3.00098 13.6372 3.00098 14.9331V18.4293C3.00098 19.7242 3.80733 20.64 5.10423 20.64H10.4483C11.7452 20.64 12.5515 19.7242 12.5515 18.4293V14.9331C12.5515 13.6372 11.7452 12.7224 10.4483 12.7224Z" stroke="currentColor"></path>
<path d="M3 15.5332H12.5515" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.0003 7.16081C21.0003 5.06236 19.2993 3.36133 17.2008 3.36133C15.1024 3.36133 13.4004 5.06236 13.4004 7.16081C13.4004 9.25926 15.1024 10.9603 17.2008 10.9603C19.2993 10.9603 21.0003 9.25926 21.0003 7.16081Z" stroke="currentColor"></path>
<path d="M20.9994 15.5283C20.9994 18.3506 18.7109 20.6391 15.8887 20.6391L16.4954 19.0062" stroke="currentColor"></path>
<path d="M3 8.47112C3 5.64887 5.28852 3.36035 8.11077 3.36035L7.50408 4.99323" stroke="currentColor"></path>
    </svg>
  ),
)

CoinToCardSwap.displayName = 'CoinToCardSwap'

export default CoinToCardSwap
