// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LineChartUpward3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.001H6C4.89543 20.001 4 19.1055 4 18.001V4.00098" stroke="currentColor"></path>
<path d="M7.49805 10.6355C7.49805 10.6355 8.93289 7.51312 11.1379 7.4499C12.825 7.40152 13.8531 9.90077 15.8715 9.90077C18.0033 9.90077 19.6409 6.27603 19.6409 6.27603" stroke="currentColor"></path>
<path d="M18.0196 15.7796V13.0303" stroke="currentColor"></path>
<path d="M11.152 15.7796V12.0225" stroke="currentColor"></path>
<path d="M14.586 15.7799V14.7637" stroke="currentColor"></path>
<path d="M7.61825 15.7799V14.7637" stroke="currentColor"></path>
    </svg>
  ),
)

LineChartUpward3.displayName = 'LineChartUpward3'

export default LineChartUpward3
