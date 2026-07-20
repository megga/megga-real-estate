// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.29688 9.51548V15.5782M12.0308 12.5459V15.5781M15.7023 8.42004V15.5777" stroke="currentColor"></path>
<path d="M3 12C3 7.03005 7.02908 3 12 3C16.9709 3 21 7.03005 21 12C21 16.9709 16.9709 21 12 21C7.02908 21 3 16.9709 3 12Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarCircle.displayName = 'Chart3BarCircle'

export default Chart3BarCircle
