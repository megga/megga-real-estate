// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dashboard6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.1344 10.3789H8.86551C7.77188 10.3789 7.08594 11.1534 7.08594 12.249V15.2068C7.08594 16.3024 7.76896 17.0769 8.86551 17.0769H15.1344C16.2319 17.0769 16.9139 16.3024 16.9139 15.2068V12.249C16.9139 11.1534 16.2319 10.3789 15.1344 10.3789Z" stroke="currentColor"></path>
<path d="M16.3972 6.92383H7.60352" stroke="currentColor"></path>
    </svg>
  ),
)

Dashboard6.displayName = 'Dashboard6'

export default Dashboard6
