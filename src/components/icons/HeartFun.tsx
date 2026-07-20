// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HeartFun = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.4999 9.77423C21.49 7.23836 20.1596 4.85356 17.5366 4.00858C15.7355 3.42736 13.7736 3.75058 12.25 5.93806C10.7264 3.75058 8.76447 3.42736 6.96339 4.00858C4.34014 4.85366 3.00971 7.23891 3.00008 9.7751C2.97582 14.8188 8.08662 18.6784 12.2487 20.5231L12.25 20.5225L12.2513 20.5231C16.4136 18.6783 21.5248 14.8183 21.4999 9.77423Z" stroke="currentColor"></path>
<path d="M15.9932 11.429C15.223 12.7518 13.8533 13.8219 12.2696 13.7945C10.6858 13.8219 9.3161 12.7518 8.5459 11.429" stroke="currentColor"></path>
    </svg>
  ),
)

HeartFun.displayName = 'HeartFun'

export default HeartFun
