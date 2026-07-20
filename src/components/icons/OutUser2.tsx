// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const OutUser2 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.7163" cy="8.07376" r="4.70071" stroke="currentColor"></circle>
<path d="M5.301 19.3997C5.19015 18.7614 5.23593 18.1 5.23593 17.4554C5.23593 15.026 7.20533 13.0566 9.63471 13.0566H13.9181C15.1003 13.0566 16.1737 13.5231 16.9641 14.282" stroke="currentColor"></path>
<path d="M18.7734 18.6368H13.8189M18.7734 18.6368L16.7757 16.6465M18.7734 18.6368L16.7757 20.626" stroke="currentColor"></path>
    </svg>
  ),
)

OutUser2.displayName = 'OutUser2'

export default OutUser2
