// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyBag = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.6899 11.3764C7.37973 10.2283 8.12404 9.09873 8.84598 7.96815L6.87281 4.27576C6.87281 4.27576 7.02362 4.14635 7.40016 3.85446C8.52588 2.98269 9.75765 2.75696 11.0896 3.27458C12.3584 3.76787 13.6456 4.14149 15.0233 4.06365C15.4242 4.0403 16.9624 3.83598 16.9624 3.83598L15.1556 7.96134C15.8776 9.09095 16.6199 10.2283 17.3098 11.3764C18.4442 13.264 19.5291 15.3695 18.6505 17.5606C17.6279 20.1117 14.6448 20.9582 11.9993 21C9.35484 20.9582 6.37174 20.1117 5.34916 17.5606C4.47057 15.3695 5.55542 13.264 6.6899 11.3764Z" stroke="currentColor"></path>
<path d="M8.84766 7.97754C10.9512 8.4611 13.0538 8.4611 15.1573 7.97754" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyBag.displayName = 'MoneyBag'

export default MoneyBag
