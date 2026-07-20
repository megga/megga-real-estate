// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DocumentCode = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.7855 3.00003C14.344 3.00003 14.8782 3.2277 15.2644 3.63051L19.0561 7.5798C19.422 7.96121 19.6273 8.47007 19.6273 8.99937V17.1645C19.6418 19.2195 18.0238 20.9163 15.9699 21C15.9699 21 8.07419 21 8.04403 20.999C5.9716 20.9533 4.32825 19.237 4.37398 17.1645V6.65743C4.42263 4.61808 6.09419 2.99224 8.13451 3.00003H13.7855Z" stroke="currentColor"></path>
<path d="M14.2686 3.0625V5.95514C14.2676 7.36693 15.4108 8.51211 16.8226 8.51601H19.5615" stroke="currentColor"></path>
<path d="M12.9628 12.2383L15.1004 14.3759L12.9297 16.5456" stroke="currentColor"></path>
<path d="M10.6288 10.2266L8.49121 12.3642L10.6619 14.5339" stroke="currentColor"></path>
    </svg>
  ),
)

DocumentCode.displayName = 'DocumentCode'

export default DocumentCode
