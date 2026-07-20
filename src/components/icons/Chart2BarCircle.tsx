// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart2BarCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.89648 8.88879V15.1089M14.1034 11.9741V15.1092" stroke="currentColor"></path>
<path d="M3 12C3 7.03005 7.02908 3 12 3C16.9709 3 21 7.03005 21 12C21 16.9709 16.9709 21 12 21C7.02908 21 3 16.9709 3 12Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart2BarCircle.displayName = 'Chart2BarCircle'

export default Chart2BarCircle
