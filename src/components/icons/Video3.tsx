// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Video3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.1515 9.67278C17.9896 8.21564 20.4563 6.80611 20.9229 7.31087C21.6943 8.13945 21.6277 16.0252 20.9229 16.7775C20.4943 17.2442 18.0086 15.8347 16.1515 14.3871" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.5144 12.037C2.5144 6.84461 4.23917 5.11414 9.41536 5.11414C14.5906 5.11414 16.3154 6.84461 16.3154 12.037C16.3154 17.2284 14.5906 18.9599 9.41536 18.9599C4.23917 18.9599 2.5144 17.2284 2.5144 12.037Z" stroke="currentColor"></path>
    </svg>
  ),
)

Video3.displayName = 'Video3'

export default Video3
