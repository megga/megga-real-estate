// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Delete2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.87622 8.00659H19.6238L18.2976 21.854H6.20246L4.87622 8.00659Z" stroke="currentColor"></path>
<path d="M8.06201 3.354H16.4387" stroke="currentColor"></path>
<path d="M12.2502 12.6035L12.2502 17.2566" stroke="currentColor"></path>
    </svg>
  ),
)

Delete2.displayName = 'Delete2'

export default Delete2
