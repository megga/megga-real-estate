// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDownCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75024 12.0001C2.75024 18.9371 5.06324 21.2501 12.0002 21.2501C18.9372 21.2501 21.2502 18.9371 21.2502 12.0001C21.2502 5.06312 18.9372 2.75012 12.0002 2.75012C5.06324 2.75012 2.75024 5.06312 2.75024 12.0001Z" stroke="currentColor"></path>
<path d="M8.52856 10.5582C8.52856 10.5582 10.9206 14.0442 12.0006 14.0442C13.0806 14.0442 15.4706 10.5582 15.4706 10.5582" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDownCircle3.displayName = 'ArrowDownCircle3'

export default ArrowDownCircle3
