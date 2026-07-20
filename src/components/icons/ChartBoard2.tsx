// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartBoard2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.02811 3.28528H16.9709C19.1961 3.28528 21 5.08917 21 7.31436V12.7708C21 14.996 19.1961 16.7999 16.9709 16.7999H7.02811C4.80389 16.7999 3 14.996 3 12.7708V7.31436C3 5.08917 4.80389 3.28528 7.02811 3.28528Z" stroke="currentColor"></path>
<path d="M8.37988 7.95801V12.1282M15.6202 8.81411V12.1271M12.1948 10.1691V12.1276" stroke="currentColor"></path>
<path d="M7.05664 20.7158H16.945" stroke="currentColor"></path>
<path d="M9.88437 16.8018L9.24707 20.7189M14.1157 16.8018L14.753 20.7189" stroke="currentColor"></path>
    </svg>
  ),
)

ChartBoard2.displayName = 'ChartBoard2'

export default ChartBoard2
