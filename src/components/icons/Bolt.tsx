// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bolt = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19.77 9.18607L14.8117 4.22776C13.0837 2.49975 10.7767 2.63986 9.04483 4.37079L4.37355 9.04304C2.64165 10.7749 2.49667 13.076 4.22955 14.8089L9.18786 19.7672C10.9217 21.5011 13.2238 21.3561 14.9547 19.6252L19.627 14.9529C21.3589 13.221 21.5029 10.9189 19.77 9.18607Z" stroke="currentColor"></path>
<path d="M11.9512 15.5L14.2148 12.001H9.71484L11.9761 8.5" stroke="currentColor"></path>
    </svg>
  ),
)

Bolt.displayName = 'Bolt'

export default Bolt
