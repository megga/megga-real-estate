// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HorizontalBarChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.45752 5.22552L14.6397 5.22553" stroke="currentColor"></path>
<path d="M8.4585 9.99603L18.0736 9.99603" stroke="currentColor"></path>
<path d="M8.45605 14.7685L11.2054 14.7685" stroke="currentColor"></path>
<path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
    </svg>
  ),
)

HorizontalBarChart2.displayName = 'HorizontalBarChart2'

export default HorizontalBarChart2
