// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartUpward2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5.35688 20.9996C4.40338 20.9996 3.62988 20.2271 3.62988 19.2726V15.9626C3.62988 15.0081 4.40338 14.2346 5.35688 14.2346C6.31136 14.2346 7.08388 15.0081 7.08388 15.9626V19.2726C7.08388 20.2271 6.31136 20.9996 5.35688 20.9996Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0004 21C11.0459 21 10.2734 20.2275 10.2734 19.273V13.4722C10.2734 12.5187 11.0459 11.7452 12.0004 11.7452C12.9539 11.7452 13.7274 12.5187 13.7274 13.4722V19.273C13.7274 20.2275 12.9539 21 12.0004 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.6429 20.9999C17.6884 20.9999 16.9159 20.2273 16.9159 19.2729V9.2621C16.9159 8.3086 17.6884 7.5351 18.6429 7.5351C19.5964 7.5351 20.3699 8.3086 20.3699 9.2621V19.2729C20.3699 20.2273 19.5964 20.9999 18.6429 20.9999Z" stroke="currentColor"></path>
<path d="M3.63086 10.5696L9.44818 6.41216L11.6305 8.71126L18.6241 3" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartUpward2.displayName = 'BarChartUpward2'

export default BarChartUpward2
