// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19.3479 12.5159H4.65205C3.64794 12.5159 2.87636 11.5701 3.01647 10.5115L3.33853 8.07423C3.45334 7.20633 4.15097 6.56124 4.97411 6.56124H19.0259C19.849 6.56124 20.5467 7.20633 20.6615 8.07423L20.9835 10.5115C21.1236 11.5701 20.3521 12.5159 19.3479 12.5159Z" stroke="currentColor"></path>
<path d="M4.67969 12.5146V18.5646C4.67969 19.5308 5.46294 20.3141 6.42813 20.3141H17.5697C18.5359 20.3141 19.3182 19.5308 19.3182 18.5646V12.5146" stroke="currentColor"></path>
<path d="M14.1255 20.3143V17.7534C14.1255 16.58 13.1739 15.6274 11.9995 15.6274C10.8261 15.6274 9.87354 16.58 9.87354 17.7534V20.3143" stroke="currentColor"></path>
<path d="M4.67969 6.56022V5.43448C4.67969 4.46831 5.46294 3.68506 6.42813 3.68506H17.5697C18.5359 3.68506 19.3182 4.46831 19.3182 5.43448V6.56022" stroke="currentColor"></path>
    </svg>
  ),
)

Store3.displayName = 'Store3'

export default Store3
