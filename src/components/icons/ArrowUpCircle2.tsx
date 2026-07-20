// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUpCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 12C3 6.892 7.141 2.75 12.25 2.75C17.358 2.75 21.5 6.892 21.5 12C21.5 17.108 17.358 21.25 12.25 21.25C7.141 21.25 3 17.108 3 12Z" stroke="currentColor"></path>
<path d="M8.77881 13.4424L12.2498 9.95638L15.7208 13.4424" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowUpCircle2.displayName = 'ArrowUpCircle2'

export default ArrowUpCircle2
