// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.9995 16.2461C10.2167 16.2461 8.77148 14.8009 8.77148 13.0181L8.77148 11.0034C8.77148 10.65 9.05795 10.3636 9.41131 10.3636L14.5877 10.3636C14.9411 10.3636 15.2275 10.65 15.2275 11.0034L15.2275 13.0181C15.2275 14.8009 13.7823 16.2461 11.9995 16.2461Z" stroke="currentColor"></path>
<path d="M12 16.2516L12 21" stroke="currentColor"></path>
<path d="M10.3164 10.3633L10.3164 8.52209M13.6839 10.3633L13.6839 8.52209" stroke="currentColor"></path>
<path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletSquare2.displayName = 'PowerOutletSquare2'

export default PowerOutletSquare2
