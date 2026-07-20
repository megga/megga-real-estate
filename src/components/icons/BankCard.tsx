// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BankCard = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21.45 19.03V4.96997H2.95001V19.03H21.45Z" stroke="currentColor"></path>
<path d="M3.01874 9.78296L21.4499 9.78296" stroke="currentColor"></path>
<path d="M15.0521 15.342H18.5271" stroke="currentColor"></path>
<path d="M10.8255 15.342H11.5735" stroke="currentColor"></path>
    </svg>
  ),
)

BankCard.displayName = 'BankCard'

export default BankCard
