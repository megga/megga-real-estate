// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TimeCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M21.5 12C21.5 17.109 17.359 21.25 12.25 21.25C7.141 21.25 3 17.109 3 12C3 6.891 7.141 2.75 12.25 2.75C17.359 2.75 21.5 6.891 21.5 12Z" stroke="currentColor"></path>
<path d="M15.6821 14.9422L11.9121 12.6932V7.84619" stroke="currentColor"></path>
    </svg>
  ),
)

TimeCircle2.displayName = 'TimeCircle2'

export default TimeCircle2
