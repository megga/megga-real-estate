// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TransactionsDownSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 16.2188V7.78411C21 4.836 18.9188 3.00098 15.9736 3.00098H8.02638C5.08119 3.00098 3 4.836 3 7.78508V16.2188C3 19.1669 5.08119 21.001 8.02638 21.001H15.9736C18.9188 21.001 21 19.1582 21 16.2188Z" stroke="currentColor"></path>
<path d="M7.80859 10.6553H10.5319" stroke="currentColor"></path>
<path d="M7.80859 7.22168H15.1071" stroke="currentColor"></path>
<path d="M14.0352 11.6071L16.7125 11.6027L16.7166 14.2803" stroke="currentColor"></path>
<path d="M16.7151 11.5976L11.9583 16.5591L9.72403 14.3315L7.2832 16.7803" stroke="currentColor"></path>
    </svg>
  ),
)

TransactionsDownSquare.displayName = 'TransactionsDownSquare'

export default TransactionsDownSquare
