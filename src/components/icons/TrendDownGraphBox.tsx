// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendDownGraphBox = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.78216 3.00049H16.2169C19.1562 3.00049 21 5.08168 21 8.02687V15.9741C21 18.9193 19.165 21.0005 16.2169 21.0005H7.78314C4.83405 21.0005 3 18.9193 3 15.9741V8.02687C3 5.08168 4.83405 3.00049 7.78216 3.00049Z" stroke="currentColor"></path>
<path d="M16.1579 16.4125V15.4249" stroke="currentColor"></path>
<path d="M11.9982 16.412V13.7412" stroke="currentColor"></path>
<path d="M7.84 16.4154V12.0613" stroke="currentColor"></path>
<path d="M16.6265 11.0682L16.0495 11.0283C12.8698 10.8094 9.83709 9.6078 7.37061 7.58791" stroke="currentColor"></path>
<path d="M15.3191 9.30961L16.6278 11.0678L14.8696 12.3764" stroke="currentColor"></path>
    </svg>
  ),
)

TrendDownGraphBox.displayName = 'TrendDownGraphBox'

export default TrendDownGraphBox
