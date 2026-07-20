// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bag32 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.2694 9.90072V6.6775C16.2694 4.46206 14.4739 2.66654 12.2595 2.66654C10.0441 2.65697 8.24004 4.44399 8.23047 6.65942V6.6775V9.90072" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.25 21.6108C17.3586 21.6108 21.5 17.4695 21.5 12.3608L21.5 7.4234L3 7.4234L3 12.3608C3 17.4695 7.14137 21.6108 12.25 21.6108V21.6108Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Bag32.displayName = 'Bag32'

export default Bag32
