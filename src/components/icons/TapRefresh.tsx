// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TapRefresh = forwardRef<SVGSVGElement, Props>(
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
<path d="M3.31248 7.58449C3.15969 8.37575 3.38967 9.2263 4.0024 9.83904C4.98329 10.8199 6.57362 10.8199 7.55451 9.83904C8.5354 8.85815 8.5354 7.26782 7.55451 6.28693C6.75649 5.48892 5.55509 5.34014 4.60667 5.8406" stroke="currentColor"></path>
<path d="M5.3877 6.63672L4.31021 5.55924L5.36654 4.50291" stroke="currentColor"></path>
    </svg>
  ),
)

TapRefresh.displayName = 'TapRefresh'

export default TapRefresh
