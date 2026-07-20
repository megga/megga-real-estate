// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Church = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 20.9662H21" stroke="currentColor"></path>
<path d="M9.97803 20.9677V17.4601C9.97803 17.0379 10.3254 16.6905 10.7476 16.6905H13.2521C13.6734 16.6905 14.0207 17.0379 14.0207 17.4601V20.9677" stroke="currentColor"></path>
<path d="M4.08496 20.967V14.0988C4.08496 13.3019 4.73199 12.6637 5.5201 12.6637H6.65458" stroke="currentColor"></path>
<path d="M17.3379 12.6646H18.595C19.3831 12.6646 20.0301 13.3029 20.0301 14.0998V20.968" stroke="currentColor"></path>
<path d="M17.3405 20.9662V10.7762C17.3405 10.2732 17.0729 9.80716 16.637 9.55419L12.7111 7.2716C12.2713 7.01668 11.7293 7.01668 11.2905 7.2716L7.36362 9.55419C6.92772 9.80716 6.66016 10.2732 6.66016 10.7762V20.9662" stroke="currentColor"></path>
<path d="M12 7.08032V3.03081H14.9501V5.31437H12" stroke="currentColor"></path>
<path d="M12.0137 12.1741L11.9497 12.1741M12 12.4334C11.856 12.4334 11.7392 12.3165 11.7392 12.1725C11.7392 12.0285 11.856 11.9118 12 11.9118C12.144 11.9118 12.2607 12.0285 12.2607 12.1725C12.2607 12.3165 12.144 12.4334 12 12.4334Z" stroke="currentColor"></path>
    </svg>
  ),
)

Church.displayName = 'Church'

export default Church
