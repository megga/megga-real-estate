// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Category = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21.0004 6.6738C21.0004 8.7024 19.3552 10.3476 17.3266 10.3476C15.298 10.3476 13.6537 8.7024 13.6537 6.6738C13.6537 4.6452 15.298 3 17.3266 3C19.3552 3 21.0004 4.6452 21.0004 6.6738Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.3467 6.6738C10.3467 8.7024 8.7024 10.3476 6.6729 10.3476C4.6452 10.3476 3 8.7024 3 6.6738C3 4.6452 4.6452 3 6.6729 3C8.7024 3 10.3467 4.6452 10.3467 6.6738Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.0004 17.2619C21.0004 19.2905 19.3552 20.9348 17.3266 20.9348C15.298 20.9348 13.6537 19.2905 13.6537 17.2619C13.6537 15.2333 15.298 13.5881 17.3266 13.5881C19.3552 13.5881 21.0004 15.2333 21.0004 17.2619Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.3467 17.2619C10.3467 19.2905 8.7024 20.9348 6.6729 20.9348C4.6452 20.9348 3 19.2905 3 17.2619C3 15.2333 4.6452 13.5881 6.6729 13.5881C8.7024 13.5881 10.3467 15.2333 10.3467 17.2619Z" stroke="currentColor"></path>
    </svg>
  ),
)

Category.displayName = 'Category'

export default Category
