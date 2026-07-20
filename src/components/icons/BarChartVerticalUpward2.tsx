// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartVerticalUpward2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.85734 20.288C3.83186 20.288 3 19.4571 3 18.4307V14.8717C3 13.8452 3.83186 13.0143 4.85734 13.0143C5.88282 13.0143 6.71469 13.8452 6.71469 14.8717V18.4307C6.71469 19.4571 5.88282 20.288 4.85734 20.288Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1427 20.2885C18.1172 20.2885 17.2853 19.4576 17.2853 18.4311V5.56983C17.2853 4.54338 18.1172 3.71152 19.1427 3.71152C20.1681 3.71152 21 4.54338 21 5.56983V18.4311C21 19.4576 20.1681 20.2885 19.1427 20.2885Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9999 20.2862C10.9744 20.2862 10.1426 19.4553 10.1426 18.4289V11.1435C10.1426 10.117 10.9744 9.28516 11.9999 9.28516C13.0254 9.28516 13.8573 10.117 13.8573 11.1435V18.4289C13.8573 19.4553 13.0254 20.2862 11.9999 20.2862Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartVerticalUpward2.displayName = 'BarChartVerticalUpward2'

export default BarChartVerticalUpward2
