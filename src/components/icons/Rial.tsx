// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Rial = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.1953 17.741H12.5293" stroke="currentColor"></path>
<path d="M3 13.1047V14.4532C3 16.081 4.31936 17.4004 5.94715 17.4004C7.57397 17.3994 8.89235 16.08 8.89235 14.4532V6.25977" stroke="currentColor"></path>
<path d="M17.4547 11.039V12.6347C17.4547 13.7809 16.5265 14.7101 15.3803 14.7101H14.4025C13.2563 14.7101 12.3262 13.7809 12.3262 12.6347V6.25879" stroke="currentColor"></path>
<path d="M21.0007 10.7529V14.28C20.9695 15.8299 19.9878 17.2009 18.5312 17.7311" stroke="currentColor"></path>
    </svg>
  ),
)

Rial.displayName = 'Rial'

export default Rial
