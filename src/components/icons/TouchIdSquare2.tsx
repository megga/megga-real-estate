// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TouchIdSquare2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M7.782 3.95898H16.217C19.165 3.95898 21 6.03999 21 8.98499V16.933C21 19.878 19.165 21.959 16.216 21.959H7.782C4.834 21.959 3 19.878 3 16.933V8.98499C3 6.03999 4.843 3.95898 7.782 3.95898Z" stroke="currentColor"></path>
<path d="M13.7642 17.4686V13.1966C13.7642 12.2006 12.9572 11.3926 11.9602 11.3926C10.9652 11.3926 10.1582 12.2006 10.1582 13.1966V13.6796" stroke="currentColor"></path>
<path d="M8.01758 10.7702C8.80458 9.38617 10.2936 8.45117 12.0006 8.45117C12.6256 8.45117 13.2216 8.57717 13.7646 8.80417" stroke="currentColor"></path>
<path d="M15.7441 10.3926C16.2701 11.1376 16.5791 12.0476 16.5791 13.0296V16.4306" stroke="currentColor"></path>
<path d="M10.1582 17.4687V15.8457" stroke="currentColor"></path>
<path d="M7.42188 16.4278V13.5918" stroke="currentColor"></path>
    </svg>
  ),
)

TouchIdSquare2.displayName = 'TouchIdSquare2'

export default TouchIdSquare2
