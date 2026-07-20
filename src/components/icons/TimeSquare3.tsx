// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TimeSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75012 12.0001C2.75012 18.9371 5.06312 21.2501 12.0001 21.2501C18.9371 21.2501 21.2501 18.9371 21.2501 12.0001C21.2501 5.06312 18.9371 2.75012 12.0001 2.75012C5.06312 2.75012 2.75012 5.06312 2.75012 12.0001Z" stroke="currentColor"></path>
<path d="M15.3903 14.0182L11.9993 11.9952V7.63416" stroke="currentColor"></path>
    </svg>
  ),
)

TimeSquare3.displayName = 'TimeSquare3'

export default TimeSquare3
