// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartHorizontalDownward = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.71189 4.85734C3.71189 3.83186 4.54278 3 5.56923 3L9.12825 3C10.1547 3 10.9856 3.83186 10.9856 4.85734C10.9856 5.88282 10.1547 6.71469 9.12825 6.71469L5.56923 6.71469C4.54278 6.71469 3.71189 5.88282 3.71189 4.85734Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71143 19.1427C3.71143 18.1172 4.54232 17.2853 5.56877 17.2853L18.4301 17.2853C19.4565 17.2853 20.2884 18.1172 20.2884 19.1427C20.2884 20.1681 19.4565 21 18.4301 21H5.56877C4.54232 21 3.71143 20.1681 3.71143 19.1427Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71387 11.9999C3.71387 10.9744 4.54476 10.1426 5.57121 10.1426L12.8566 10.1426C13.883 10.1426 14.7149 10.9744 14.7149 11.9999C14.7149 13.0254 13.883 13.8573 12.8566 13.8573L5.57121 13.8573C4.54476 13.8573 3.71387 13.0254 3.71387 11.9999Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartHorizontalDownward.displayName = 'BarChartHorizontalDownward'

export default BarChartHorizontalDownward
