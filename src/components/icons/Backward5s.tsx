// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Backward5s = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 9.80078L4.2804 12.0211L6.48803 10.7475" stroke="currentColor"></path>
<path d="M4.50195 11.8128C4.60119 7.34311 8.2556 3.75 12.7497 3.75C17.306 3.75 20.9993 7.44429 20.9993 11.9996C20.9993 16.556 17.306 20.2493 12.7497 20.2493C9.93296 20.2493 7.4461 18.8385 5.95749 16.6834" stroke="currentColor"></path>
<path d="M11.5293 14.6522H13.41C14.1621 14.6522 14.7721 14.0422 14.7721 13.2901C14.7721 12.538 14.1621 11.9289 13.41 11.9289H11.5293V9.35156H14.5133" stroke="currentColor"></path>
    </svg>
  ),
)

Backward5s.displayName = 'Backward5s'

export default Backward5s
