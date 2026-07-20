// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoreSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75 12.0001C2.75 5.06312 5.063 2.75012 12 2.75012C18.937 2.75012 21.25 5.06312 21.25 12.0001C21.25 18.9371 18.937 21.2501 12 21.2501C5.063 21.2501 2.75 18.9371 2.75 12.0001Z" stroke="currentColor"></path>
<path d="M15.9935 12H16.0025" stroke="currentColor"></path>
<path d="M11.9945 12H12.0035" stroke="currentColor"></path>
<path d="M7.9955 12H8.0045" stroke="currentColor"></path>
    </svg>
  ),
)

MoreSquare3.displayName = 'MoreSquare3'

export default MoreSquare3
