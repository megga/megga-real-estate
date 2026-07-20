// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarRefresh = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.66476 18.0514C2.36156 14.6334 2.38394 9.18484 5.74844 5.79408C7.8549 3.67108 10.7796 2.85185 13.5175 3.34222" stroke="currentColor"></path>
<path d="M18.3352 5.94824C21.6384 9.36625 21.616 14.8148 18.2515 18.2056C16.1451 20.3286 13.2203 21.1478 10.4824 20.6575" stroke="currentColor"></path>
<path d="M13.8064 9.19434H11.197C10.4215 9.19434 9.79297 9.82287 9.79297 10.5993C9.79297 11.3747 10.4215 12.0042 11.197 12.0042H12.8033C13.5788 12.0042 14.2083 12.6328 14.2083 13.4092C14.2083 14.1846 13.5788 14.8142 12.8033 14.8142H10.1938" stroke="currentColor"></path>
<path d="M3 17.8427L5.68245 18.3759L6.21271 15.708" stroke="currentColor"></path>
<path d="M20.9998 6.15721L18.3174 5.62402L17.7871 8.29188" stroke="currentColor"></path>
<path d="M12 14.8119V15.9911M12 8.00684V9.19677" stroke="currentColor"></path>
    </svg>
  ),
)

DollarRefresh.displayName = 'DollarRefresh'

export default DollarRefresh
