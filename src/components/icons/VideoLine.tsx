// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoLine = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2179 21H7.78317C4.8355 21 3 18.9193 3 15.9737V8.02633C3 5.08071 4.8355 3 7.7842 3H16.2179C19.1666 3 21 5.08071 21 8.02633V15.9737C21 18.9193 19.1573 21 16.2179 21Z" stroke="currentColor"></path>
<path d="M7.43164 16.2773H11.3243" stroke="currentColor"></path>
<path d="M3.00586 7.71165H20.9915M8.86574 7.71135V3M15.1319 7.71135V3" stroke="currentColor"></path>
    </svg>
  ),
)

VideoLine.displayName = 'VideoLine'

export default VideoLine
