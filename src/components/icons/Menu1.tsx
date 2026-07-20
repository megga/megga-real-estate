// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Menu1 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.9452 20.0005H9.00516C7.29273 20.0005 5.9043 18.6121 5.9043 16.8997V7.09891C5.9043 5.38551 7.29273 3.99805 9.00516 3.99805H14.9452C16.6576 3.99805 18.046 5.38551 18.046 7.09891V16.8997C18.046 18.6121 16.6576 20.0005 14.9452 20.0005Z" stroke="currentColor"></path>
<path d="M21 7.4668V16.5349M3 7.4668V16.5349" stroke="currentColor"></path>
<path d="M6.07617 15.2441H17.8832" stroke="currentColor"></path>
    </svg>
  ),
)

Menu1.displayName = 'Menu1'

export default Menu1
