// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TickSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.44019 12.0001L10.8142 14.3731L15.5602 9.62708" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.74976 12.0001C2.74976 18.9371 5.06276 21.2501 11.9998 21.2501C18.9368 21.2501 21.2498 18.9371 21.2498 12.0001C21.2498 5.06312 18.9368 2.75012 11.9998 2.75012C5.06276 2.75012 2.74976 5.06312 2.74976 12.0001Z" stroke="currentColor"></path>
    </svg>
  ),
)

TickSquare3.displayName = 'TickSquare3'

export default TickSquare3
