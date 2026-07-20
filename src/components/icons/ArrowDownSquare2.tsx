// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDownSquare2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M3 21.25H21.5V2.75H3V21.25Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M12.25 15.3383V7.91406" stroke="currentColor" strokeLinecap="square"></path>
<path d="M15.998 12.3223L12.25 16.0863L8.50195 12.3223" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

ArrowDownSquare2.displayName = 'ArrowDownSquare2'

export default ArrowDownSquare2
