// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Activity2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M7.46674 15.2544L10.2723 11.608L13.4724 14.1219L16.2179 10.5785" stroke="currentColor"></path>
<circle cx="19.4181" cy="5.33638" r="1.80171" stroke="currentColor"></circle>
<path d="M14.6653 4.32397H3.28021V21.5346H20.4909V10.1238" stroke="currentColor"></path>
    </svg>
  ),
)

Activity2.displayName = 'Activity2'

export default Activity2
