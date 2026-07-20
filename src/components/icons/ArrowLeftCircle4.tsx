// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeftCircle4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.25 12.2743L19.25 12.2743" stroke="currentColor"></path>
<path d="M10.3003 18.2988C10.3003 18.2988 4.25029 15.0378 4.25029 12.2758C4.25029 9.51176 10.3003 6.24976 10.3003 6.24976" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowLeftCircle4.displayName = 'ArrowLeftCircle4'

export default ArrowLeftCircle4
