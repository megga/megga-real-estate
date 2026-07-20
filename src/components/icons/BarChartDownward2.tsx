// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartDownward2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19.4475 20.9997C20.3047 20.9997 20.9994 20.305 20.9994 19.4478V16.9658C20.9994 16.1086 20.3047 15.4139 19.4475 15.4139C18.5904 15.4139 17.8957 16.1086 17.8957 16.9658V19.4478C17.8957 20.305 18.5904 20.9997 19.4475 20.9997Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9992 20.9996C12.8564 20.9996 13.5511 20.3049 13.5511 19.4477V13.2412C13.5511 12.384 12.8564 11.6893 11.9992 11.6893C11.1421 11.6893 10.4474 12.384 10.4474 13.2412V19.4477C10.4474 20.3049 11.1421 20.9996 11.9992 20.9996Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M4.55188 20.9999C5.40906 20.9999 6.10376 20.3052 6.10376 19.448V4.55194C6.10376 3.69476 5.40906 3.00006 4.55188 3.00006C3.6947 3.00006 3 3.69476 3 4.55194V19.448C3 20.3052 3.6947 20.9999 4.55188 20.9999Z" stroke="currentColor"></path>
<path d="M20.9992 9.82827L14.1719 3M20.9992 9.82827L20.9999 5.48277M20.9992 9.82827L16.6556 9.82803" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartDownward2.displayName = 'BarChartDownward2'

export default BarChartDownward2
