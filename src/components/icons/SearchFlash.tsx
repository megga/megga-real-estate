// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchFlash = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.049 11.4171C20.049 6.76827 16.2807 3 11.6319 3C6.98311 3 3.21484 6.76827 3.21484 11.4171C3.21484 16.0659 6.98311 19.8351 11.6319 19.8351C16.2807 19.8351 20.049 16.0659 20.049 11.4171Z" stroke="currentColor"></path>
<path d="M17.3613 17.582L20.7861 20.9991" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.2851 7.12417L7.93765 11.735C7.69879 12.0639 7.93376 12.5246 8.33997 12.5246H11.0784V15.4196C11.0784 15.9013 11.6957 16.1022 11.9788 15.7115L15.3263 11.1012C15.5652 10.7723 15.3302 10.3111 14.924 10.3111H12.1851V7.41654C12.1851 6.93444 11.5683 6.73401 11.2851 7.12417Z" stroke="currentColor"></path>
    </svg>
  ),
)

SearchFlash.displayName = 'SearchFlash'

export default SearchFlash
