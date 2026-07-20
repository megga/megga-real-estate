// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScreemZoomOut2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.5859 21V18.4887C8.5859 16.7909 7.20913 15.4141 5.5103 15.4141H3" stroke="currentColor"></path>
<path d="M15.4141 21V18.4887C15.4141 16.7908 16.7908 15.4141 18.4897 15.4141H21" stroke="currentColor"></path>
<path d="M8.5859 3V5.51127C8.5859 7.2101 7.20913 8.58687 5.5103 8.58687H3" stroke="currentColor"></path>
<path d="M15.4141 3V5.51127C15.4141 7.2101 16.7908 8.58687 18.4897 8.58687H21" stroke="currentColor"></path>
    </svg>
  ),
)

ScreemZoomOut2.displayName = 'ScreemZoomOut2'

export default ScreemZoomOut2
