// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Face = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12.25" cy="12.1387" r="9.25" stroke="currentColor"></circle>
<path d="M16.4976 12.6899C16.4976 15.036 14.5958 16.9378 12.2498 16.9378C9.90378 16.9378 8.00195 15.036 8.00195 12.6899" stroke="currentColor"></path>
    </svg>
  ),
)

Face.displayName = 'Face'

export default Face
