// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ElectricCharging2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.7227 18.7868C14.7227 20.0091 13.7318 21 12.5094 21L11.1281 21C10.8858 21 10.6894 20.8036 10.6894 20.5613L10.6894 17.0122C10.6894 16.7699 10.8858 16.5735 11.1281 16.5735L12.5094 16.5735C13.7318 16.5735 14.7227 17.5644 14.7227 18.7868Z" stroke="currentColor"></path>
<path d="M10.6895 19.9414L9.27832 19.9414M10.6895 17.6325L9.27832 17.6325" stroke="currentColor"></path>
<path d="M14.7455 18.9946C17.366 18.9946 18.9966 17.1453 18.9966 14.5282V7.46639C18.9966 4.84932 17.366 3 14.7463 3H9.25134C6.63946 3 5.00195 4.84932 5.00195 7.46639V14.5282C5.00195 15.9744 5.4996 17.1861 6.38694 17.9809" stroke="currentColor"></path>
<path d="M11.9882 13.0195L13.9284 10.0204H10.0713L12.0095 7.01953" stroke="currentColor"></path>
    </svg>
  ),
)

ElectricCharging2.displayName = 'ElectricCharging2'

export default ElectricCharging2
