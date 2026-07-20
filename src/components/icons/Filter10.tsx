// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter10 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M15.4186 14.2988C17.0513 14.2988 18.3729 15.6223 18.3729 17.254C18.3729 18.8868 17.0513 20.21 15.4186 20.21C13.7858 20.21 12.4629 18.8868 12.4629 17.254C12.4629 15.6223 13.7858 14.2988 15.4186 14.2988Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.85023 3.78906C10.483 3.78906 11.8063 5.11239 11.8063 6.74514C11.8063 8.37692 10.483 9.70025 8.85023 9.70025C7.21748 9.70025 5.89453 8.377 5.89453 6.74523C5.89453 5.11247 7.21748 3.78906 8.85023 3.78906Z" stroke="currentColor"></path>
<path d="M3 6.74609H5.89478M11.8048 6.74609H21" stroke="currentColor"></path>
<path d="M3 17.2539H12.4628M18.3728 17.2539H21" stroke="currentColor"></path>
    </svg>
  ),
)

Filter10.displayName = 'Filter10'

export default Filter10
