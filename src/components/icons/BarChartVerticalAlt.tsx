// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartVerticalAlt = forwardRef<SVGSVGElement, Props>(
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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M4.85734 20.2878C5.88282 20.2878 6.71469 19.4569 6.71469 18.4305V10.0953C6.71469 9.06983 5.88282 8.23797 4.85734 8.23797C3.83186 8.23797 3 9.06983 3 10.0953V18.4305C3 19.4569 3.83186 20.2878 4.85734 20.2878Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1427 20.2885C18.1172 20.2885 17.2853 19.4576 17.2853 18.4311V5.56983C17.2853 4.54338 18.1172 3.71152 19.1427 3.71152C20.1681 3.71152 21 4.54338 21 5.56983V18.4311C21 19.4576 20.1681 20.2885 19.1427 20.2885Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9999 20.2893C13.0254 20.2893 13.8573 19.4584 13.8573 18.432V14.873C13.8573 13.8465 13.0254 13.0156 11.9999 13.0156C10.9744 13.0156 10.1426 13.8465 10.1426 14.873V18.432C10.1426 19.4584 10.9744 20.2893 11.9999 20.2893Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartVerticalAlt.displayName = 'BarChartVerticalAlt'

export default BarChartVerticalAlt
