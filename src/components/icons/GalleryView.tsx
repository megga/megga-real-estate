// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GalleryView = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.783 3H16.217C19.165 3 20.999 5.081 20.999 8.026V15.973C20.999 18.918 19.165 20.999 16.216 20.999H7.783C4.835 20.999 3 18.918 3 15.973V8.026C3 5.081 4.843 3 7.783 3Z" stroke="currentColor"></path>
<path d="M8.99023 3.01172V20.9997" stroke="currentColor"></path>
<path d="M15.0332 3.01172V20.9997" stroke="currentColor"></path>
<path d="M3.00195 15.041H20.999" stroke="currentColor"></path>
<path d="M3.00195 8.99805H21" stroke="currentColor"></path>
    </svg>
  ),
)

GalleryView.displayName = 'GalleryView'

export default GalleryView
