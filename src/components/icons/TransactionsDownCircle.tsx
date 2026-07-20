// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TransactionsDownCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.36328 7.74316L15.6353 7.74316" stroke="currentColor"></path>
<path d="M7.36328 10.7432H9.84464" stroke="currentColor"></path>
<path d="M11.7168 16.4929L8.95485 16.4975L8.95064 13.7354" stroke="currentColor"></path>
<path d="M8.95197 16.5029L13.859 11.3847L16.1638 13.6826L20.4453 9.23926" stroke="currentColor"></path>
<path d="M3 12.001C3 16.9709 7.02908 21.001 12 21.001C16.9709 21.001 21 16.9709 21 12.001C21 7.03006 16.9709 3.00098 12 3.00098C7.02908 3.00098 3 7.03006 3 12.001Z" stroke="currentColor"></path>
    </svg>
  ),
)

TransactionsDownCircle.displayName = 'TransactionsDownCircle'

export default TransactionsDownCircle
