// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoPlaylist2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.10768 20.0197H12.0613C13.7776 20.0197 15.169 18.6284 15.169 16.9121V7.08795C15.169 5.37162 13.7776 3.98027 12.0613 3.98027H6.10768C4.39135 3.98027 3 5.37162 3 7.08795V16.9121C3 18.6284 4.39135 20.0197 6.10768 20.0197Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.2631 12.8716C10.6462 13.4301 9.87466 13.9331 9.0272 14.2747C8.30428 14.5588 7.70006 14.2046 7.61152 13.4934C7.50352 12.4435 7.50547 11.4394 7.61152 10.5024C7.70785 9.76299 8.37433 9.44872 9.0272 9.7231C9.86201 10.0656 10.6112 10.5297 11.2631 11.1271C11.8196 11.6311 11.8333 12.3472 11.2631 12.8716Z" stroke="currentColor"></path>
<path d="M18.0801 6.54297V17.4568" stroke="currentColor"></path>
<path d="M21 8.92188V15.0769" stroke="currentColor"></path>
    </svg>
  ),
)

VideoPlaylist2.displayName = 'VideoPlaylist2'

export default VideoPlaylist2
