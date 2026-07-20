// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoadingCircle1 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.77637 6.63133C5.19627 6.0582 5.68482 5.5388 6.2281 5.0791" stroke="currentColor"></path>
<path d="M3.32681 9.5459C3.06413 10.5091 2.9497 11.528 3.02831 12.5797" stroke="currentColor"></path>
<path d="M6.85181 19.3612C5.4956 18.4239 4.41003 17.1174 3.73242 15.5791" stroke="currentColor"></path>
<path d="M17.5634 19.0859C16.2072 20.1486 14.5325 20.8362 12.6848 20.9745C11.7743 21.0421 10.8868 20.9705 10.041 20.7805" stroke="currentColor"></path>
<path d="M19.6446 16.7241C20.554 15.2555 21.0615 13.5192 20.9898 11.6635C20.7988 6.69133 16.6137 2.81573 11.6406 3.00677" stroke="currentColor"></path>
    </svg>
  ),
)

LoadingCircle1.displayName = 'LoadingCircle1'

export default LoadingCircle1
