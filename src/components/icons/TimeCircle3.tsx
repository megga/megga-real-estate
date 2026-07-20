// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TimeCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21.2498 12.0001C21.2498 17.1081 17.1088 21.2501 11.9998 21.2501C6.89176 21.2501 2.74976 17.1081 2.74976 12.0001C2.74976 6.89112 6.89176 2.75012 11.9998 2.75012C17.1088 2.75012 21.2498 6.89112 21.2498 12.0001Z" stroke="currentColor"></path>
<path d="M16.1906 12.7672L11.6606 12.6932V7.84619" stroke="currentColor"></path>
    </svg>
  ),
)

TimeCircle3.displayName = 'TimeCircle3'

export default TimeCircle3
