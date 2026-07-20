// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2169 3H7.78216C4.83405 3 3 5.08119 3 8.02735V15.9736C3 18.9198 4.83405 21 7.78314 21H16.2169C19.165 21 21 18.9198 21 15.9736V8.02735C21 5.08119 19.1562 3 16.2169 3Z" stroke="currentColor"></path>
<path d="M16.166 13.7371V16.5656M11.9663 11.0377V16.5661M7.83493 7.4375V16.5659" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarSquare3.displayName = 'Chart3BarSquare3'

export default Chart3BarSquare3
