// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RadarChart = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M12 21.0005C16.9706 21.0005 21 16.9711 21 12.0005C21 7.02993 16.9706 3.00049 12 3.00049C7.02944 3.00049 3 7.02993 3 12.0005C3 16.9711 7.02944 21.0005 12 21.0005Z" stroke="currentColor"></path>
<path d="M12 21.0005V16.1543V12.0005V7.84664V3.00049" stroke="currentColor"></path>
<path d="M21 12.0005H16.1538H12H7.84615H3" stroke="currentColor"></path>
<path d="M12 16.1544C14.2941 16.1544 16.1539 14.2946 16.1539 12.0005C16.1539 9.70642 14.2941 7.84668 12 7.84668C9.70593 7.84668 7.84619 9.70642 7.84619 12.0005C7.84619 14.2946 9.70593 16.1544 12 16.1544Z" stroke="currentColor"></path>
    </svg>
  ),
)

RadarChart.displayName = 'RadarChart'

export default RadarChart
