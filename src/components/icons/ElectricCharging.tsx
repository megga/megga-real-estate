// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ElectricCharging = forwardRef<SVGSVGElement, Props>(
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
<path d="M6.29902 16.9319C3.15033 13.7832 3.15033 8.67819 6.29902 5.52949C9.44772 2.38079 14.5528 2.38079 17.7015 5.52949C20.8502 8.67819 20.8502 13.7832 17.7015 16.9319C16.8421 17.7913 15.837 18.4161 14.7657 18.8064" stroke="currentColor"></path>
<path d="M11.9882 13.0195L13.9284 10.0204H10.0713L12.0095 7.01953" stroke="currentColor"></path>
    </svg>
  ),
)

ElectricCharging.displayName = 'ElectricCharging'

export default ElectricCharging
