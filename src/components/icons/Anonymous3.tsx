// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Anonymous3 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="10.4912" cy="8.6431" r="4.70071" stroke="currentColor"></circle>
<path d="M10.6614 13.3437L8.40962 13.3438C5.98024 13.3438 4.01083 15.3132 4.01083 17.7425C4.01083 18.3872 3.96505 19.0486 4.0759 19.6868" stroke="currentColor"></path>
<path d="M17.6099 20.9551V20.9619" stroke="currentColor"></path>
<path d="M17.6083 18.7411C17.5976 17.9328 18.3333 17.5899 18.88 17.2774C19.5472 16.91 19.9989 16.3251 19.9989 15.5129C19.9989 14.3098 19.026 13.3438 17.8307 13.3438C16.6276 13.3438 15.6626 14.3098 15.6626 15.5129" stroke="currentColor"></path>
    </svg>
  ),
)

Anonymous3.displayName = 'Anonymous3'

export default Anonymous3
