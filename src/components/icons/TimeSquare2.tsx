// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TimeSquare2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M15.641 14.0178L12.25 11.9948V7.63379" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.25L21.5 2.75L3 2.75L3 21.25L21.5 21.25Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

TimeSquare2.displayName = 'TimeSquare2'

export default TimeSquare2
