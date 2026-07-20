// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GalleryViewEdit = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.6835 20.1572H7.42699C4.70074 20.1572 3 18.2414 3 15.5152V8.16445C3 5.43917 4.70074 3.51367 7.42699 3.51367H15.2175C17.9525 3.51367 19.6435 5.43917 19.6435 8.16445V10.1172" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.6176 20.3246L14.7302 20.4734C14.0813 20.5824 13.5072 20.0404 13.5782 19.3866L13.6775 18.4711C13.7251 18.0293 13.91 17.6129 14.2058 17.2821L18.0724 13.0623C18.5287 12.569 19.2993 12.5389 19.7935 12.9962L20.6089 13.7512C21.1022 14.2075 21.1323 14.9781 20.675 15.4724L16.8523 19.6445C16.5292 20.0044 16.0943 20.2448 15.6176 20.3246Z" stroke="currentColor"></path>
<path d="M3.0019 9.06383H19.6435M3 14.6517H11.4298M14.1288 11.9532V3.52344M8.53849 3.52724V20.1572" stroke="currentColor"></path>
    </svg>
  ),
)

GalleryViewEdit.displayName = 'GalleryViewEdit'

export default GalleryViewEdit
