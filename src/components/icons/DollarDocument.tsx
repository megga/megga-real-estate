// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarDocument = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.269 3.06081V5.95345C14.2681 7.36524 15.4113 8.51042 16.8231 8.51432H19.562M15.2644 3.63051C14.8782 3.2277 14.344 3.00003 13.7855 3.00003H8.13451C6.09419 2.99224 4.42263 4.61808 4.37398 6.65743V17.1645C4.32825 19.237 5.9716 20.9533 8.04403 20.999C8.07419 21 15.9699 21 15.9699 21C18.0238 20.9163 19.6418 19.2195 19.6273 17.1645V8.99937C19.6273 8.47007 19.422 7.96121 19.0561 7.5798L15.2644 3.63051Z" stroke="currentColor"></path>
<path d="M12.712 10.8281H10.3146C9.60138 10.8281 9.02344 11.4061 9.02344 12.1193C9.02344 12.8324 9.60138 13.4104 10.3146 13.4104H11.7896C12.5028 13.4104 13.0807 13.9883 13.0807 14.7015C13.0807 15.4147 12.5028 15.9927 11.7896 15.9927H9.39219" stroke="currentColor"></path>
<path d="M11.0527 15.9923V17.0761M11.0527 9.7373V10.8309" stroke="currentColor"></path>
    </svg>
  ),
)

DollarDocument.displayName = 'DollarDocument'

export default DollarDocument
