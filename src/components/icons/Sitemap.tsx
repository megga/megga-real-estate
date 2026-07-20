// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Sitemap = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8.50724 5.7507C8.50724 4.50808 9.51459 3.50073 10.7572 3.50073H13.2628C14.5054 3.50073 15.5128 4.50808 15.5128 5.7507C15.5128 6.99333 14.5054 8.00068 13.2628 8.00068H10.7572C9.51459 8.00068 8.50724 6.99333 8.50724 5.7507Z" stroke="currentColor"></path>
<path d="M2.99699 18.2507C2.99699 17.0081 4.00433 16.0007 5.24696 16.0007H7.75257C8.99519 16.0007 10.0025 17.0081 10.0025 18.2507C10.0025 19.4933 8.99519 20.5007 7.75257 20.5007H5.24696C4.00433 20.5007 2.99699 19.4933 2.99699 18.2507Z" stroke="currentColor"></path>
<path d="M13.997 18.2507C13.997 17.0081 15.0043 16.0007 16.247 16.0007H18.7526C19.9952 16.0007 21.0025 17.0081 21.0025 18.2507C21.0025 19.4933 19.9952 20.5007 18.7526 20.5007H16.247C15.0043 20.5007 13.997 19.4933 13.997 18.2507Z" stroke="currentColor"></path>
<path d="M11.9971 8.00073V10.0007M11.9971 10.0007C11.9971 11.1053 12.8925 12.0007 13.9971 12.0007H15.4971C16.6016 12.0007 17.4971 12.8962 17.4971 14.0007V16.0007M11.9971 10.0007C11.9971 11.1053 11.1016 12.0007 9.99707 12.0007H8.49707C7.3925 12.0007 6.49707 12.8962 6.49707 14.0007V16.0007" stroke="currentColor"></path>
    </svg>
  ),
)

Sitemap.displayName = 'Sitemap'

export default Sitemap
