// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Sta5r = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M12.25 2.75C13.8358 7.03544 17.2146 10.4142 21.5 12C17.2146 13.5858 13.8358 16.9646 12.25 21.25C10.6642 16.9646 7.28544 13.5858 3 12C7.28544 10.4142 10.6642 7.03544 12.25 2.75Z" stroke="currentColor"></path>
    </svg>
  ),
)

Sta5r.displayName = 'Sta5r'

export default Sta5r
