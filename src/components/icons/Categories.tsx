// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Categories = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M13.6175 3.43639L19.1626 6.68715C20.2173 7.305 20.2173 8.8287 19.1626 9.44655L13.6175 12.6973C12.6251 13.2792 11.3962 13.2792 10.4037 12.6973L4.85867 9.44655C3.80492 8.8287 3.80492 7.305 4.85867 6.68715L10.4037 3.43639C11.3962 2.85454 12.6251 2.85454 13.6175 3.43639Z" stroke="currentColor"></path>
<path d="M8.78785 11.75L4.63026 14.5152C3.64754 15.1701 3.68938 16.6286 4.7081 17.225L10.402 20.5633C11.3945 21.1452 12.6244 21.1452 13.6158 20.5633L19.2903 17.2367C20.3149 16.6364 20.3509 15.1701 19.3584 14.5191L15.1726 11.7841" stroke="currentColor"></path>
    </svg>
  ),
)

Categories.displayName = 'Categories'

export default Categories
