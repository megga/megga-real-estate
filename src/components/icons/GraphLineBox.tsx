// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GraphLineBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 21.0005H16.2178C19.1659 21.0005 21 18.9203 21 15.9741V8.02784C21 5.08168 19.1659 3.00049 16.2169 3.00049H7.78313C4.83503 3.00049 3 5.08168 3 8.02784V15.9741C3 18.9203 4.84378 21.0005 7.78313 21.0005Z" stroke="currentColor"></path>
<path d="M7.34766 9.52002L10.2598 13.3039L13.5815 10.6963L16.4313 14.3742" stroke="currentColor"></path>
    </svg>
  ),
)

GraphLineBox.displayName = 'GraphLineBox'

export default GraphLineBox
