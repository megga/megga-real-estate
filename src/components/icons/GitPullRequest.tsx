// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitPullRequest = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.7088 20.0016C15.3431 20.0016 14.2354 18.8939 14.2354 17.5282C14.2354 16.1624 15.3431 15.0547 16.7088 15.0547C18.0745 15.0547 19.1823 16.1624 19.1823 17.5282C19.1823 18.8939 18.0745 20.0016 16.7088 20.0016Z" stroke="currentColor"></path>
<path d="M12.4805 8.62084V5.33677L15.7654 5.33594" stroke="currentColor"></path>
<path d="M16.7513 15.0518V11.239C16.7513 10.1935 16.3358 9.19131 15.5968 8.45225L12.4805 5.33594" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.29085 20.0015C5.92512 20.0015 4.81738 18.8938 4.81738 17.528C4.81738 16.1623 5.92535 15.0547 7.29108 15.0547C8.65681 15.0547 9.76431 16.1623 9.76431 17.528C9.76431 18.8938 8.65658 20.0015 7.29085 20.0015Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.29108 8.94657C5.92535 8.94657 4.81738 7.83919 4.81738 6.47347C4.81738 5.10774 5.92512 4 7.29085 4C8.65658 4 9.76431 5.10774 9.76431 6.47347C9.76431 7.83919 8.65681 8.94657 7.29108 8.94657Z" stroke="currentColor"></path>
<path d="M7.29102 8.94531V15.0519" stroke="currentColor"></path>
    </svg>
  ),
)

GitPullRequest.displayName = 'GitPullRequest'

export default GitPullRequest
