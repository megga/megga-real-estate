// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Face2 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="12.25" cy="12.1387" r="9.25" stroke="currentColor"></circle>
<path d="M11.6863 8.41602L9.77051 14.9092L9.95175 15.2112H13.5445" stroke="currentColor"></path>
<path d="M16.6357 11.313H16.6457" stroke="currentColor"></path>
<path d="M7.18262 11.313H7.19262" stroke="currentColor"></path>
    </svg>
  ),
)

Face2.displayName = 'Face2'

export default Face2
