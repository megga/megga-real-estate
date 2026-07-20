// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Game3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.25467 12.0624V15.6376" stroke="currentColor"></path>
<path d="M11.0793 13.8496H7.43152" stroke="currentColor"></path>
<path d="M15.4773 12.1711H15.3751" stroke="currentColor"></path>
<path d="M17.2081 15.5832H17.1059" stroke="currentColor"></path>
<path d="M8.51404 2.21606C8.52072 2.93015 9.10593 3.50295 9.82001 3.49626H10.8281C11.9308 3.48767 12.8329 4.37169 12.8482 5.47432V6.48148" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.8121 13.8953C21.8121 8.33539 19.4255 6.48145 12.2646 6.48145C5.10271 6.48145 2.71606 8.33539 2.71606 13.8953C2.71606 19.4562 5.10271 21.3092 12.2646 21.3092C19.4255 21.3092 21.8121 19.4562 21.8121 13.8953Z" stroke="currentColor"></path>
    </svg>
  ),
)

Game3.displayName = 'Game3'

export default Game3
