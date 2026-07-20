// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CalendarCharts = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.19413 4.42285H15.8145C18.4658 4.42285 20.1082 5.89496 20.1004 8.60178V16.8147C20.1004 19.5215 18.458 21.0023 15.8067 21.0023H8.19413C5.55056 21.0023 3.90039 19.4952 3.90039 16.7466V8.60178C3.90039 5.89496 5.55056 4.42285 8.19413 4.42285Z" stroke="currentColor"></path>
<path d="M15.6403 3.00098V5.57741M8.36914 3.00098V5.57741" stroke="currentColor"></path>
<path d="M15.9639 16.6109V14.5176" stroke="currentColor"></path>
<path d="M10.7349 16.6116V13.751" stroke="currentColor"></path>
<path d="M13.3498 16.6111V15.8374" stroke="currentColor"></path>
<path d="M8.04465 16.6111V15.8374" stroke="currentColor"></path>
<path d="M7.69775 12.6493L10.4562 9.66032L13.6031 11.7203L16.302 8.81445" stroke="currentColor"></path>
    </svg>
  ),
)

CalendarCharts.displayName = 'CalendarCharts'

export default CalendarCharts
