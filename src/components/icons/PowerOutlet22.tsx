// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutlet22 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.94727 9.17399C6.94727 12.1289 9.48283 14.4913 12.4971 14.2033C15.1241 13.9532 17.0535 11.5967 17.0535 8.95702V7.43043C17.0535 6.81065 16.5524 6.30859 15.9327 6.30859H8.06813C7.44932 6.30859 6.94727 6.81065 6.94727 7.43043V9.17399Z" stroke="currentColor"></path>
<path d="M9.45898 3V6.30908" stroke="currentColor"></path>
<path d="M14.541 3V6.30908" stroke="currentColor"></path>
<path d="M16.5409 21C16.5409 20.2596 15.9279 19.6593 15.1729 19.6593H14.1162C12.9496 19.6544 12.0058 18.7291 12 17.5868V14.3906" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutlet22.displayName = 'PowerOutlet22'

export default PowerOutlet22
