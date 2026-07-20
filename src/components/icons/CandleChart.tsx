// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CandleChart = forwardRef<SVGSVGElement, Props>(
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
<path d="M10.209 16.3569V13.9544" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.7343 13.9546H9.68307C9.12071 13.9546 8.66455 13.5002 8.66455 12.9393V9.79125C8.66455 9.23037 9.12071 8.77661 9.68307 8.77661H10.7343C11.2973 8.77661 11.7535 9.23037 11.7535 9.79125V12.9393C11.7535 13.5002 11.2973 13.9546 10.7343 13.9546Z" stroke="currentColor"></path>
<path d="M10.209 8.77637V6.37382" stroke="currentColor"></path>
<path d="M16.73 14.9839V12.5813" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.2553 12.5815H16.2041C15.6417 12.5815 15.1855 12.1271 15.1855 11.5662V7.41821C15.1855 6.85733 15.6417 6.40356 16.2041 6.40356H17.2553C17.8183 6.40356 18.2745 6.85733 18.2745 7.41821V11.5662C18.2745 12.1271 17.8183 12.5815 17.2553 12.5815Z" stroke="currentColor"></path>
<path d="M16.73 6.40332V4.00077" stroke="currentColor"></path>
    </svg>
  ),
)

CandleChart.displayName = 'CandleChart'

export default CandleChart
