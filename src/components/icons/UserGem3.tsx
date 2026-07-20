// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserGem3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.4711 20.0007L19.2821 16.8771L18.3451 15.207H14.5972L13.6602 16.8771L16.4711 20.0007Z" stroke="currentColor"></path>
<path d="M4.71875 19.8212C4.71875 17.7361 6.36473 15.1406 11.1049 15.1406" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.184 8.07932C15.184 10.3318 13.3572 12.1586 11.1047 12.1586C8.85218 12.1586 7.02539 10.3318 7.02539 8.07932C7.02539 5.8259 8.85218 4 11.1047 4C13.3572 4 15.184 5.8259 15.184 8.07932Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserGem3.displayName = 'UserGem3'

export default UserGem3
