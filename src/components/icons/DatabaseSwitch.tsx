// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseSwitch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.3185 9.25053C14.3652 9.25053 17.6458 7.92716 17.6458 6.2947C17.6458 4.66224 14.3652 3.33887 10.3185 3.33887C6.27174 3.33887 2.99121 4.66224 2.99121 6.2947C2.99121 7.92716 6.27174 9.25053 10.3185 9.25053Z" stroke="currentColor"></path>
<path d="M2.99121 12V17.7737C2.99121 17.7737 2.99121 20.6615 10.2845 20.6615" stroke="currentColor"></path>
<path d="M17.6455 11.9992V6.22559" stroke="currentColor"></path>
<path d="M2.99121 6.22559V11.9992C2.99121 11.9992 2.99121 14.8861 10.2845 14.8861" stroke="currentColor"></path>
<path d="M19.3975 20.5529V15.1494" stroke="currentColor"></path>
<path d="M21.0089 18.999L19.3965 20.5547L17.7842 18.999" stroke="currentColor"></path>
<path d="M14.8897 15.2275V20.6311" stroke="currentColor"></path>
<path d="M13.2764 16.7823L14.8887 15.2266L16.5011 16.7823" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseSwitch.displayName = 'DatabaseSwitch'

export default DatabaseSwitch
