// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartDownward = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18.6429 20.9996C19.5974 20.9996 20.3699 20.2271 20.3699 19.2726V15.9626C20.3699 15.0081 19.5974 14.2346 18.6429 14.2346C17.6894 14.2346 16.9159 15.0081 16.9159 15.9626V19.2726C16.9159 20.2271 17.6894 20.9996 18.6429 20.9996Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0004 21C12.9548 21 13.7274 20.2275 13.7274 19.273V13.4722C13.7274 12.5187 12.9548 11.7452 12.0004 11.7452C11.0469 11.7452 10.2734 12.5187 10.2734 13.4722V19.273C10.2734 20.2275 11.0469 21 12.0004 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.35688 20.9999C6.31136 20.9999 7.08388 20.2273 7.08388 19.2729V9.2621C7.08388 8.3086 6.31136 7.5351 5.35688 7.5351C4.40338 7.5351 3.62988 8.3086 3.62988 9.2621V19.2729C3.62988 20.2273 4.40338 20.9999 5.35688 20.9999Z" stroke="currentColor"></path>
<path d="M20.3702 10.5696L14.5529 6.41216L12.3706 8.71126L5.37695 3" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartDownward.displayName = 'BarChartDownward'

export default BarChartDownward
