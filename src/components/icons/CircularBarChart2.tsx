// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircularBarChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.0005C21 7.03054 16.9709 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005Z" stroke="currentColor"></path>
<path d="M12.0004 12.0005L5.5 17.5007M12.0004 12.0005L12 3.00049M12.0004 12.0005H21" stroke="currentColor"></path>
    </svg>
  ),
)

CircularBarChart2.displayName = 'CircularBarChart2'

export default CircularBarChart2
