// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUpSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 2.75H21.5V21.25H3V2.75Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M12.25 8.6617V16.0859" stroke="currentColor" strokeLinecap="square"></path>
<path d="M15.998 11.6777L12.25 7.91373L8.50195 11.6777" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

ArrowUpSquare2.displayName = 'ArrowUpSquare2'

export default ArrowUpSquare2
