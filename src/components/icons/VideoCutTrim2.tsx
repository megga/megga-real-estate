// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoCutTrim2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 16.0016V7.99888C3 5.20159 4.97416 3.46094 7.76854 3.46094H16.2315C19.0258 3.46094 21 5.20159 21 7.99888V16.0016C21 18.7979 19.0258 20.5376 16.2315 20.5376H7.76854C4.97416 20.5376 3 18.7882 3 16.0016Z" stroke="currentColor"></path>
<path d="M20.9949 15.5977H18.8038M15.7281 15.5977H13.537M10.4614 15.5977H8.27022M5.19504 15.5977H3.00391" stroke="currentColor"></path>
<path d="M20.9949 8.39844H18.8038M15.7281 8.39844H13.537M10.4614 8.39844H8.27022M5.19504 8.39844H3.00391" stroke="currentColor"></path>
    </svg>
  ),
)

VideoCutTrim2.displayName = 'VideoCutTrim2'

export default VideoCutTrim2
