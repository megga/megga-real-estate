// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.29688 13.544V16.0582M12.03 11.1445V16.0587M15.7023 7.94434V16.0585" stroke="currentColor"></path>
<path d="M3 12C3 7.03005 7.02908 3 12 3C16.9709 3 21 7.03005 21 12C21 16.9709 16.9709 21 12 21C7.02908 21 3 16.9709 3 12Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarCircle2.displayName = 'Chart3BarCircle2'

export default Chart3BarCircle2
