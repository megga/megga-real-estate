// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02735V15.9736C21 18.9198 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9198 3 15.9736V8.02735C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M7.83398 13.7371V16.5656M12.0337 11.0377V16.5661M16.1651 7.4375V16.5659" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarSquare2.displayName = 'Chart3BarSquare2'

export default Chart3BarSquare2
