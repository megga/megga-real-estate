// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const YenCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M9.2832 8.51074L11.9988 11.9103L14.7163 8.51074" stroke="currentColor"></path>
<path d="M12 15.985V11.9092" stroke="currentColor"></path>
<path d="M9.49902 13.9369H14.505" stroke="currentColor"></path>
<path d="M9.62305 11.9082H14.378" stroke="currentColor"></path>
    </svg>
  ),
)

YenCircle.displayName = 'YenCircle'

export default YenCircle
