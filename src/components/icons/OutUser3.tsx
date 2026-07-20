// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const OutUser3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.30273 19.9996C3.30273 17.8907 4.96691 15.2656 9.76106 15.2656C14.5552 15.2656 16.2194 17.8719 16.2194 19.9817" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.8871 8.12565C13.8871 10.4038 12.0405 12.2513 9.76143 12.2513C7.4833 12.2513 5.63672 10.4038 5.63672 8.12565C5.63672 5.84752 7.4833 4 9.76143 4C12.0405 4 13.8871 5.84752 13.8871 8.12565Z" stroke="currentColor"></path>
<path d="M20.6963 12.0452H16.0234M18.811 10.168L20.6952 12.0446L18.811 13.9213" stroke="currentColor"></path>
    </svg>
  ),
)

OutUser3.displayName = 'OutUser3'

export default OutUser3
