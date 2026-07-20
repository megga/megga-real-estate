// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Download2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.2497 15.935V3.15723" stroke="currentColor"></path>
<path d="M8.9751 13.395L12.2501 16.6846L15.5261 13.395" stroke="currentColor"></path>
<path d="M16.875 9.41406H21.5V20.8429H3V9.41406H7.625" stroke="currentColor"></path>
    </svg>
  ),
)

Download2.displayName = 'Download2'

export default Download2
