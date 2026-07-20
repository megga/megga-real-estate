// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Share6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12 3.5C7.30517 3.5 3.5 7.30517 3.5 12C3.5 16.6948 7.30517 20.5 12 20.5C16.6948 20.5 20.5 16.6948 20.5 12" stroke="currentColor"></path>
<path d="M20.5023 7.56867V3.5H16.4336M20.5012 3.5L13.6445 10.3567" stroke="currentColor"></path>
    </svg>
  ),
)

Share6.displayName = 'Share6'

export default Share6
