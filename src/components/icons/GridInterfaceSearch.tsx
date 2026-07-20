// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterfaceSearch = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5.09909 20.3998H7.5859C8.74527 20.3998 9.68498 19.4601 9.68498 18.3007V15.8139C9.68498 14.6546 8.74527 13.7148 7.5859 13.7148H5.09909C3.93972 13.7148 3 14.6546 3 15.8139V18.3007C3 19.4601 3.93972 20.3998 5.09909 20.3998Z" stroke="currentColor"></path>
<path d="M19.3467 19.1399L21.0008 20.7901M17.1104 13.4453C18.9258 13.4453 20.3965 14.917 20.3965 16.7324C20.3965 18.5469 18.9258 20.0186 17.1104 20.0186C15.2949 20.0186 13.8242 18.5469 13.8242 16.7324C13.8242 14.917 15.2949 13.4453 17.1104 13.4453Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.09909 9.89397H7.5859C8.74527 9.89397 9.68498 8.95425 9.68498 7.79488V5.30807C9.68498 4.1487 8.74527 3.20898 7.5859 3.20898H5.09909C3.93972 3.20898 3 4.1487 3 5.30807V7.79488C3 8.95425 3.93972 9.89397 5.09909 9.89397Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.6049 9.89397H18.0918C19.2511 9.89397 20.1908 8.95425 20.1908 7.79488V5.30807C20.1908 4.1487 19.2511 3.20898 18.0918 3.20898H15.6049C14.4456 3.20898 13.5059 4.1487 13.5059 5.30807V7.79488C13.5059 8.95425 14.4456 9.89397 15.6049 9.89397Z" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterfaceSearch.displayName = 'GridInterfaceSearch'

export default GridInterfaceSearch
