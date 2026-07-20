// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Export = forwardRef<SVGSVGElement, Props>(
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
      <path d="M2.99986 12C2.99986 16.9706 7.02933 21.0001 11.9999 21.0001C16.9705 21.0001 21 16.9706 21 12" stroke="currentColor"></path>
<path d="M12 14.2501L12 3M12 3L15.375 6.37503M12 3L8.62495 6.37503" stroke="currentColor"></path>
    </svg>
  ),
)

Export.displayName = 'Export'

export default Export
