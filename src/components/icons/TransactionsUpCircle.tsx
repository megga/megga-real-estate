// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TransactionsUpCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.6367 16.2588H8.3647" stroke="currentColor"></path>
<path d="M16.6367 13.259H14.1554" stroke="currentColor"></path>
<path d="M12.2832 7.5103L15.0451 7.50577L15.0494 10.2679" stroke="currentColor"></path>
<path d="M15.048 7.50038L10.141 12.6186L7.83618 10.3207L3.55469 14.764" stroke="currentColor"></path>
<path d="M21 12.001C21 7.03103 16.9709 3.00098 12 3.00098C7.02908 3.00098 3 7.03103 3 12.001C3 16.9719 7.02908 21.001 12 21.001C16.9709 21.001 21 16.9719 21 12.001Z" stroke="currentColor"></path>
    </svg>
  ),
)

TransactionsUpCircle.displayName = 'TransactionsUpCircle'

export default TransactionsUpCircle
