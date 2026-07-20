// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoFolder = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.6409 20.9845C18.9966 20.9845 20.9737 19.0074 20.9737 15.6526L21 10.9969C21 7.57399 19.7585 5.86156 16.3949 5.86156H13.7416C13.0683 5.86058 12.4349 5.54339 12.0292 5.00534L11.173 3.86696C10.7692 3.32891 10.1358 3.01172 9.46346 3.01172H7.58757C4.23178 3.01172 3 4.9888 3 8.33875V15.6526C3 19.0074 4.98097 20.9845 8.34454 20.9845H15.6409Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.1185 14.1957C13.3284 14.9109 12.3409 15.555 11.255 15.9928C10.3307 16.3567 9.55621 15.9023 9.44237 14.9916C9.30421 13.648 9.30713 12.3617 9.44237 11.162C9.56594 10.2153 10.4192 9.81346 11.255 10.1647C12.3243 10.6035 13.2846 11.197 14.1185 11.9618C14.8317 12.6078 14.8482 13.5254 14.1185 14.1957Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoFolder.displayName = 'VideoFolder'

export default VideoFolder
