// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Ticket4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.3593 3.59998V6.25523" stroke="currentColor"></path>
<path d="M13.3593 17.5439V19.7641" stroke="currentColor"></path>
<path d="M13.3593 14.5439V9.25525" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 14.0504C18.8093 14.0504 18.8093 9.94867 21.5 9.94867C21.5 5.19622 21.5 3.5 12 3.5C2.5 3.5 2.5 5.19622 2.5 9.94867C5.19074 9.94867 5.19074 14.0504 2.5 14.0504C2.5 18.8038 2.5 20.5 12 20.5C21.5 20.5 21.5 18.8038 21.5 14.0504Z" stroke="currentColor"></path>
    </svg>
  ),
)

Ticket4.displayName = 'Ticket4'

export default Ticket4
