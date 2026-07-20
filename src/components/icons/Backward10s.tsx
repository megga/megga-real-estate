// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Backward10s = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.50195 11.8128C4.60119 7.34311 8.2556 3.75 12.7497 3.75C17.306 3.75 20.9993 7.44429 20.9993 11.9996C20.9993 16.556 17.306 20.2493 12.7497 20.2493C9.93296 20.2493 7.4461 18.8385 5.95749 16.6834" stroke="currentColor"></path>
<path d="M3 9.80078L4.2804 12.0211L6.48803 10.7475" stroke="currentColor"></path>
<path d="M10.209 14.6115V9.38672" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.4667 14.7133C13.5803 14.7133 12.8613 13.9943 12.8613 13.1079V10.8954C12.8613 10.0081 13.5803 9.28906 14.4667 9.28906C15.3531 9.28906 16.0721 10.0081 16.0721 10.8954V13.1079C16.0721 13.9943 15.3531 14.7133 14.4667 14.7133Z" stroke="currentColor"></path>
    </svg>
  ),
)

Backward10s.displayName = 'Backward10s'

export default Backward10s
