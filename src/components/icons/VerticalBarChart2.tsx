// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VerticalBarChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.49327 14.8044V8.62213" stroke="currentColor"></path>
<path d="M13.2638 14.8034V5.18829" stroke="currentColor"></path>
<path d="M18.0362 14.8057V12.0564" stroke="currentColor"></path>
<path d="M20 20.0008H6C4.89543 20.0008 4 19.1054 4 18.0008V4.00079" stroke="currentColor"></path>
    </svg>
  ),
)

VerticalBarChart2.displayName = 'VerticalBarChart2'

export default VerticalBarChart2
