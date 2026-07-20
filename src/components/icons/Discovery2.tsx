// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Discovery2 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9.26663 14.9844L9.26562 14.9847L10.3374 10.0869L15.2341 9.01539L15.2351 9.01514L14.1634 13.9129L9.26663 14.9844Z" stroke="currentColor"></path>
<circle cx="12.25" cy="12" r="9.25" stroke="currentColor"></circle>
    </svg>
  ),
)

Discovery2.displayName = 'Discovery2'

export default Discovery2
