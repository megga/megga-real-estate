// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BubbleChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
<circle cx="14.954" cy="7.8374" r="2.85535" stroke="currentColor"></circle>
<circle cx="8.70417" cy="12.9069" r="1.59724" stroke="currentColor"></circle>
<circle cx="16.9333" cy="15.4032" r="1.41231" stroke="currentColor"></circle>
    </svg>
  ),
)

BubbleChart2.displayName = 'BubbleChart2'

export default BubbleChart2
