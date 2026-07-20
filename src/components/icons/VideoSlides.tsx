// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoSlides = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.9452 20.0025H9.00516C7.29273 20.0025 5.9043 18.6141 5.9043 16.9016V7.10086C5.9043 5.38843 7.29273 4 9.00516 4H14.9452C16.6576 4 18.046 5.38843 18.046 7.10086V16.9016C18.046 18.6141 16.6576 20.0025 14.9452 20.0025Z" stroke="currentColor"></path>
<path d="M3 7.46484V16.533" stroke="currentColor"></path>
<path d="M21 7.46484V16.533" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.9753 12.8714C13.3594 13.4289 12.5907 13.93 11.7443 14.2715C11.0233 14.5556 10.42 14.2015 10.3315 13.4912C10.2245 12.4453 10.2264 11.4431 10.3315 10.5081C10.4288 9.76958 11.0933 9.45725 11.7443 9.73066C12.5771 10.0722 13.3253 10.5353 13.9753 11.1308C14.5308 11.6348 14.5435 12.3489 13.9753 12.8714Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoSlides.displayName = 'VideoSlides'

export default VideoSlides
