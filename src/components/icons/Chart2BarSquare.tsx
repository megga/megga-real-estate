// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart2BarSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02735V15.9736C21 18.9198 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9198 3 15.9736V8.02735C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M9.63379 8.5V15.4976M14.3666 11.971V15.498" stroke="currentColor"></path>
    </svg>
  ),
)

Chart2BarSquare.displayName = 'Chart2BarSquare'

export default Chart2BarSquare
