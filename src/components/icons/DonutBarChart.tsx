// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DonutBarChart = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M11.9998 17.2618C14.9057 17.2618 17.2614 14.9062 17.2614 12.0003C17.2614 10.5382 16.665 9.21538 15.7022 8.26185C14.7515 7.32027 13.4436 6.73877 11.9998 6.73877C9.09395 6.73877 6.73828 9.09444 6.73828 12.0003C6.73828 14.9062 9.09395 17.2618 11.9998 17.2618Z" stroke="currentColor"></path>
<path d="M12 21.0005C16.9706 21.0005 21 16.971 21 12.0005C21 9.49951 19.9799 7.2368 18.333 5.60575C16.7069 3.99517 14.4696 3.00049 12 3.00049C7.02944 3.00049 3 7.02992 3 12.0005C3 16.971 7.02944 21.0005 12 21.0005Z" stroke="currentColor"></path>
<path d="M12 3.00049V6.73895" stroke="currentColor"></path>
<path d="M15.7021 8.26184L18.2305 5.50586" stroke="currentColor"></path>
<path d="M3 12.0005H6.73846" stroke="currentColor"></path>
    </svg>
  ),
)

DonutBarChart.displayName = 'DonutBarChart'

export default DonutBarChart
