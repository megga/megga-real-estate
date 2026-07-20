// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDownCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M3 12C3 17.108 7.141 21.25 12.25 21.25C17.358 21.25 21.5 17.108 21.5 12C21.5 6.892 17.358 2.75 12.25 2.75C7.141 2.75 3 6.892 3 12Z" stroke="currentColor"></path>
<path d="M8.77881 10.5576L12.2498 14.0436L15.7208 10.5576" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDownCircle2.displayName = 'ArrowDownCircle2'

export default ArrowDownCircle2
