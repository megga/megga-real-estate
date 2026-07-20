// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ComputerCode2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.02811 3.28516H16.9709C19.1961 3.28516 21 5.08905 21 7.31424V12.7707C21 14.9959 19.1961 16.7998 16.9709 16.7998H7.02811C4.80389 16.7998 3 14.9959 3 12.7707V7.31424C3 5.08905 4.80389 3.28516 7.02811 3.28516Z" stroke="currentColor"></path>
<path d="M10.0252 7.85156L7.85938 10.0184L10.0252 12.1842" stroke="currentColor"></path>
<path d="M13.9746 7.85156L16.1414 10.0184L13.9746 12.1842" stroke="currentColor"></path>
<path d="M7.05566 20.7148H16.944" stroke="currentColor"></path>
<path d="M9.88437 16.7969L9.24707 20.7141" stroke="currentColor"></path>
<path d="M14.1152 16.7969L14.7525 20.7141" stroke="currentColor"></path>
    </svg>
  ),
)

ComputerCode2.displayName = 'ComputerCode2'

export default ComputerCode2
