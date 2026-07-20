// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DotBarLineChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3118 19.9979V13.4249M12.0002 19.9979V15.6079M4.68848 19.9979V11.2419" stroke="currentColor"></path>
<path d="M13.625 10.519L17.7327 8.92765" stroke="currentColor"></path>
<path d="M10.5779 10.1016L6.08643 6.65963" stroke="currentColor"></path>
<path d="M13.1936 12.1808C13.8529 11.5215 13.8529 10.4525 13.1936 9.79321C12.5343 9.13389 11.4653 9.13389 10.806 9.79321C10.1467 10.4525 10.1467 11.5215 10.806 12.1808C11.4653 12.8401 12.5343 12.8401 13.1936 12.1808Z" stroke="currentColor"></path>
<path d="M5.88209 6.88442C6.5414 6.2251 6.5414 5.15614 5.88209 4.49682C5.22277 3.8375 4.1538 3.8375 3.49449 4.49682C2.83517 5.15614 2.83517 6.2251 3.49449 6.88442C4.1538 7.54374 5.22277 7.54374 5.88209 6.88442Z" stroke="currentColor"></path>
<path d="M20.5056 9.54799C21.1649 8.88868 21.1649 7.81971 20.5056 7.16039C19.8463 6.50108 18.7773 6.50108 18.118 7.16039C17.4587 7.81971 17.4587 8.88868 18.118 9.54799C18.7773 10.2073 19.8463 10.2073 20.5056 9.54799Z" stroke="currentColor"></path>
    </svg>
  ),
)

DotBarLineChart.displayName = 'DotBarLineChart'

export default DotBarLineChart
