// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Menu2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 7.4668V16.5349" stroke="currentColor"></path>
<path d="M21 7.4668V16.5349" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.00712 20.0005H14.9471C16.6595 20.0005 18.048 18.6121 18.048 16.8997V7.09891C18.048 5.38551 16.6595 3.99805 14.9471 3.99805H9.00712C7.29468 3.99805 5.90625 5.38551 5.90625 7.09891V16.8997C5.90625 18.6121 7.29468 20.0005 9.00712 20.0005Z" stroke="currentColor"></path>
    </svg>
  ),
)

Menu2.displayName = 'Menu2'

export default Menu2
