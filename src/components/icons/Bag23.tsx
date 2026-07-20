// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bag23 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.9996 9.6842V8.5723C16.9996 5.94933 14.8732 3.823 12.2503 3.823C9.62731 3.823 7.50098 5.94933 7.50098 8.5723V9.6842" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.4369 21.2463L21.5 7.89379L3 7.89379L4.06307 21.2463L20.4369 21.2463Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Bag23.displayName = 'Bag23'

export default Bag23
