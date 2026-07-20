// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartDownwardVertical = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19.9997 12H14.9994V20.0012H19.9997C20.5524 20.0012 21 19.5526 21 19.0009V13.0003C21 12.4476 20.5524 12 19.9997 12Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.9997 8H8.99936V20.0003H15V9.00027C15 8.44759 14.5524 8 13.9997 8Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.00071 4H4.00061C3.44793 4 3.00034 4.44759 3.00034 5.00027V19.0011C3.00034 19.5528 3.44793 20.0014 4.00061 20.0014H9.00098V5.00027C9.00098 4.44759 8.55339 4 8.00071 4Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartDownwardVertical.displayName = 'BarChartDownwardVertical'

export default BarChartDownwardVertical
