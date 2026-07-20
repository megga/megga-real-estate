// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PoundSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M10.7262 11.7539C11.3654 12.541 11.419 13.6522 10.8585 14.4977C10.4557 15.0192 10.0257 15.5203 9.56836 15.9961H14.1968" stroke="currentColor"></path>
<path d="M14.3138 8.83412C13.4945 7.85336 12.0351 7.72298 11.0543 8.54223C10.093 9.3459 9.94608 10.7694 10.7235 11.753" stroke="currentColor"></path>
<path d="M8.79688 12.1396H13.4253" stroke="currentColor"></path>
    </svg>
  ),
)

PoundSquare.displayName = 'PoundSquare'

export default PoundSquare
