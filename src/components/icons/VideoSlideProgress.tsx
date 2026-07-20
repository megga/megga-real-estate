// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoSlideProgress = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.02811 3.89453H16.9709C19.1961 3.89453 21 5.69842 21 7.92361V16.08C21 18.3052 19.1961 20.1091 16.9709 20.1091H7.02811C4.80389 20.1091 3 18.3052 3 16.08V7.92361C3 5.69842 4.80389 3.89453 7.02811 3.89453Z" stroke="currentColor"></path>
<path d="M10.2305 16.4802H17.2475M10.2305 15.5391V17.1892" stroke="currentColor"></path>
<path d="M6.75195 16.4805H7.93314" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7812 10.6628C13.1945 11.194 12.4609 11.6727 11.6533 11.9987C10.9664 12.2692 10.3914 11.9315 10.3067 11.2543C10.2036 10.2561 10.2065 9.30061 10.3067 8.40937C10.3992 7.70494 11.0326 7.40623 11.6533 7.66796C12.4482 7.99294 13.1614 8.43467 13.7812 9.00288C14.3105 9.48256 14.3232 10.1646 13.7812 10.6628Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoSlideProgress.displayName = 'VideoSlideProgress'

export default VideoSlideProgress
