// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MultiChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.00439 12.8711V20.028C3.00439 20.5039 3.39024 20.8898 3.8662 20.8898H11.0231" stroke="currentColor"></path>
<path d="M5.24365 17.6544L7.27163 15.1493L8.80626 17.045L10.8562 14.5669" stroke="currentColor"></path>
<path d="M20.9956 20.8899V18.9692" stroke="currentColor"></path>
<path d="M17.8633 20.8902L17.8633 14.6543" stroke="currentColor"></path>
<path d="M14.7305 20.8899L14.7305 17.2231" stroke="currentColor"></path>
<path d="M16.0162 7.12723C16.0162 4.90958 14.2184 3.11133 12.0003 3.11133C9.7822 3.11133 7.98438 4.90958 7.98438 7.12723C7.98438 9.34531 9.7822 11.1431 12.0003 11.1431C14.2184 11.1431 16.0162 9.34531 16.0162 7.12723Z" stroke="currentColor"></path>
<path d="M11.8613 3.1123V6.81789C11.8613 7.06432 12.0611 7.2641 12.3075 7.2641H16.0131" stroke="currentColor"></path>
    </svg>
  ),
)

MultiChart.displayName = 'MultiChart'

export default MultiChart
