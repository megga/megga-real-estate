// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Logout8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.5775 7.62065V6.73816C14.5775 4.81457 13.0178 3.25391 11.0933 3.25391H6.48328C4.55969 3.25488 3 4.81457 3 6.73816V17.2619C3 19.1865 4.55969 20.7462 6.48328 20.7462H11.103C13.0217 20.7462 14.5765 19.1914 14.5775 17.2726V16.3814" stroke="currentColor"></path>
<path d="M21.0001 11.9987H9.61523M21.0001 11.9987L18.2314 9.24219M21.0001 11.9987L18.2314 14.7561" stroke="currentColor"></path>
    </svg>
  ),
)

Logout8.displayName = 'Logout8'

export default Logout8
