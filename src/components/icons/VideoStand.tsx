// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoStand = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5559 5.92578H6.67034C4.62027 5.92578 3.33398 7.37747 3.33398 9.43241V13.1842C3.33398 15.2392 4.61346 16.6918 6.67034 16.6918H12.5549C14.6128 16.6918 15.8933 15.2392 15.8933 13.1842V9.43241C15.8933 7.37747 14.6128 5.92578 12.5559 5.92578Z" stroke="currentColor"></path>
<path d="M9.35742 3H13.5529" stroke="currentColor"></path>
<path d="M15.8867 10.4627L18.8388 8.0468C19.3175 7.65469 20.0219 7.72474 20.414 8.20248C20.5784 8.40291 20.668 8.65491 20.667 8.91373L20.6563 13.7086C20.6553 14.3264 20.1533 14.8265 19.5354 14.8246C19.2766 14.8246 19.0265 14.7351 18.8271 14.5707L15.8867 12.1557" stroke="currentColor"></path>
<path d="M7.31055 21.0008L10.4465 16.6914L13.5211 20.9151" stroke="currentColor"></path>
<path d="M11.9924 9.41067V9.36251M11.9924 9.10938C11.8542 9.10938 11.7422 9.22137 11.7422 9.35914C11.7422 9.49738 11.8542 9.60938 11.9924 9.60938C12.1307 9.60938 12.2427 9.49738 12.2427 9.35914C12.2427 9.22137 12.1307 9.10938 11.9924 9.10938Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoStand.displayName = 'VideoStand'

export default VideoStand
