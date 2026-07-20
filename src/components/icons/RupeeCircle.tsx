// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RupeeCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M9.66211 8.84961H10.5952C11.7968 8.84961 12.7708 9.82258 12.7708 11.0232V11.0252C12.7708 12.2258 11.7978 13.1998 10.5962 13.1998H9.66308L12.7727 16.3094" stroke="currentColor"></path>
<path d="M9.66211 8.85254H14.6379" stroke="currentColor"></path>
<path d="M9.66211 10.9414H14.6379" stroke="currentColor"></path>
    </svg>
  ),
)

RupeeCircle.displayName = 'RupeeCircle'

export default RupeeCircle
