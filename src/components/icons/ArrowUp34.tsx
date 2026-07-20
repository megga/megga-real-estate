// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUp34 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.1062 11.2999L12.1062 20.2499" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.1002 3.64613C10.8442 3.64613 6.82919 10.0101 7.55119 10.7321C8.27319 11.4541 15.8582 11.5231 16.6492 10.7321C17.4402 9.94014 13.3552 3.64613 12.1002 3.64613Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowUp34.displayName = 'ArrowUp34'

export default ArrowUp34
