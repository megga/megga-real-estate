// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart2BarSquare2 = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M9.03948 16.7184C8.37105 16.7184 7.8291 16.1764 7.8291 15.508V11.4449C7.8291 10.7764 8.37105 10.2345 9.03948 10.2345C9.70791 10.2345 10.2499 10.7764 10.2499 11.4449V15.508C10.2499 16.1764 9.70791 16.7184 9.03948 16.7184Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9619 16.7181C14.2934 16.7181 13.7515 16.1762 13.7515 15.5078V8.49553C13.7515 7.8271 14.2934 7.28516 14.9619 7.28516C15.6303 7.28516 16.1723 7.8271 16.1723 8.49553V15.5078C16.1723 16.1762 15.6303 16.7181 14.9619 16.7181Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart2BarSquare2.displayName = 'Chart2BarSquare2'

export default Chart2BarSquare2
