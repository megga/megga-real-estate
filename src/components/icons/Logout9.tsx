// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Logout9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 12.0005L8 12.0005M20 12.0005L17.0823 15M20 12.0005L17.0823 9" stroke="currentColor"></path>
<path d="M14 8.75L14 7.5C14 5.01472 11.7614 3 9 3C6.23858 3 4 5.01472 4 7.5L4 16.5C4 18.9853 6.23858 21 9 21C11.7614 21 14 18.9853 14 16.5L14 15.25" stroke="currentColor"></path>
    </svg>
  ),
)

Logout9.displayName = 'Logout9'

export default Logout9
