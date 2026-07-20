// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutlet = forwardRef<SVGSVGElement, Props>(
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
<path d="M10.5039 12.0019H10.5769M13.3497 12.0019H13.4227M17.1699 12.0024C17.1699 9.14673 14.8552 6.83203 11.9995 6.83203C9.1438 6.83203 6.82812 9.14673 6.82812 12.0024C6.82812 14.8581 9.1438 17.1728 11.9995 17.1728C14.8552 17.1728 17.1699 14.8581 17.1699 12.0024Z" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutlet.displayName = 'PowerOutlet'

export default PowerOutlet
