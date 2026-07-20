// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Pound = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.7532 11.6311C11.7125 12.8128 11.7935 14.4812 10.9525 15.7503C10.3474 16.5341 9.70096 17.2853 9.01562 18.0001H15.9643" stroke="currentColor"></path>
<path d="M16.1432 7.24639C14.9131 5.77407 12.7221 5.57792 11.2498 6.80882C9.80602 8.01511 9.58605 10.1521 10.7526 11.6284" stroke="currentColor"></path>
<path d="M7.85742 12.21H14.8061" stroke="currentColor"></path>
    </svg>
  ),
)

Pound.displayName = 'Pound'

export default Pound
