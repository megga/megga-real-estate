// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.25L21.5 2.75L3 2.75L3 21.25L21.5 21.25Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M15.5883 12L8.16406 12" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.5723 8.25205L16.3363 12L12.5723 15.748" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

ArrowRightSquare2.displayName = 'ArrowRightSquare2'

export default ArrowRightSquare2
