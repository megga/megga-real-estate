// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const IntoUser3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.30176 19.9996C3.30176 17.8907 4.96593 15.2656 9.76008 15.2656C14.5542 15.2656 16.2184 17.8719 16.2184 19.9817" stroke="currentColor"></path>
<path d="M16.0244 12.0452H20.6973M16.0244 12.0452L17.9086 10.168M16.0244 12.0452L17.9086 13.9213" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.8861 8.12565C13.8861 10.4038 12.0395 12.2513 9.76046 12.2513C7.48232 12.2513 5.63574 10.4038 5.63574 8.12565C5.63574 5.84752 7.48232 4 9.76046 4C12.0395 4 13.8861 5.84752 13.8861 8.12565Z" stroke="currentColor"></path>
    </svg>
  ),
)

IntoUser3.displayName = 'IntoUser3'

export default IntoUser3
