// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Discount3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75024 12.0001C2.75024 5.06312 5.06324 2.75012 12.0002 2.75012C18.9372 2.75012 21.2502 5.06312 21.2502 12.0001C21.2502 18.9371 18.9372 21.2501 12.0002 21.2501C5.06324 21.2501 2.75024 18.9371 2.75024 12.0001Z" stroke="currentColor"></path>
<path d="M9.42993 14.5699L14.5699 9.42993" stroke="currentColor"></path>
<path d="M14.4955 14.5H14.5045" stroke="currentColor"></path>
<path d="M9.4955 9.5H9.5045" stroke="currentColor"></path>
    </svg>
  ),
)

Discount3.displayName = 'Discount3'

export default Discount3
