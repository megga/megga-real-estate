// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TapRotate2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.6384 11.6447C21.5428 14.0861 20.6529 17.3164 19.0681 18.9013C17.2518 20.7175 13.3949 21.0198 10.9916 19.8722C9.45682 19.1394 7.8477 17.9915 6.88517 17.2576C6.33486 16.838 6.09715 16.1356 6.24727 15.4601C6.51884 14.238 7.89901 13.6312 8.98308 14.2574L10.1473 14.9298C10.5529 15.1641 11.06 14.8714 11.06 14.403V5.0373C11.06 4.16023 11.771 3.44922 12.6481 3.44922C13.5157 3.44922 14.2227 4.14545 14.236 5.01291L14.2991 9.12148C16.5216 9.33371 19.7397 9.21905 20.6384 11.6447Z" stroke="currentColor"></path>
<path d="M7.06357 6.03674C7.73111 6.4882 8.16992 7.25225 8.16992 8.1188C8.16992 9.50598 7.04539 10.6305 5.6582 10.6305C4.27102 10.6305 3.14648 9.50598 3.14648 8.1188C3.14648 6.99023 3.8908 6.03551 4.91532 5.71875" stroke="currentColor"></path>
<path d="M4.93652 6.83594L4.93652 5.31215L3.44266 5.31215" stroke="currentColor"></path>
    </svg>
  ),
)

TapRotate2.displayName = 'TapRotate2'

export default TapRotate2
