// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TransactionsDownSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 16.2188V7.78411C21 4.836 18.9188 3.00098 15.9736 3.00098H8.02638C5.08119 3.00098 3 4.836 3 7.78508V16.2188C3 19.1669 5.08119 21.001 8.02638 21.001H15.9736C18.9188 21.001 21 19.1582 21 16.2188Z" stroke="currentColor"></path>
<path d="M7.80859 13.3467H10.5319" stroke="currentColor"></path>
<path d="M7.80859 16.7803H15.1071" stroke="currentColor"></path>
<path d="M14.0352 12.3948L16.7125 12.3992L16.7166 9.72168" stroke="currentColor"></path>
<path d="M16.7151 12.4044L11.9583 7.44289L9.72403 9.67045L7.2832 7.22168" stroke="currentColor"></path>
    </svg>
  ),
)

TransactionsDownSquare2.displayName = 'TransactionsDownSquare2'

export default TransactionsDownSquare2
