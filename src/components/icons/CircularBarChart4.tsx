// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircularBarChart4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.0005C21 7.03054 16.9709 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005Z" stroke="currentColor"></path>
<path d="M12 12.0005L16.9991 19.5002M12 12.0005L3.48633 14.9233M12 12.0005V3.00049M12 12.0005H20.999" stroke="currentColor"></path>
    </svg>
  ),
)

CircularBarChart4.displayName = 'CircularBarChart4'

export default CircularBarChart4
