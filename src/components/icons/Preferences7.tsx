// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences7 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M10.1445 7.65625V10.1889" stroke="currentColor"></path>
<path d="M13.0645 16.3432V13.8105" stroke="currentColor"></path>
<path d="M16.1695 15.0762H15.5215" stroke="currentColor"></path>
<path d="M13.0637 15.0762H7.82617" stroke="currentColor"></path>
<path d="M16.1704 8.92188H12.6035" stroke="currentColor"></path>
<path d="M10.1448 8.92188H7.82617" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences7.displayName = 'Preferences7'

export default Preferences7
