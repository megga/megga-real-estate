// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartVerticalDownward2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19.1428 20.2876C20.1682 20.2876 21 19.4567 21 18.4303V14.8715C21 13.8451 20.1682 13.0142 19.1428 13.0142C18.1173 13.0142 17.2855 13.8451 17.2855 14.8715V18.4303C17.2855 19.4567 18.1173 20.2876 19.1428 20.2876Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M4.85725 20.288C5.88267 20.288 6.71449 19.4572 6.71449 18.4308V5.57016C6.71449 4.54376 5.88267 3.71194 4.85725 3.71194C3.83182 3.71194 3 4.54376 3 5.57016V18.4308C3 19.4572 3.83182 20.288 4.85725 20.288Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9998 20.2856C13.0252 20.2856 13.8571 19.4548 13.8571 18.4284V11.1434C13.8571 10.117 13.0252 9.28516 11.9998 9.28516C10.9744 9.28516 10.1426 10.117 10.1426 11.1434V18.4284C10.1426 19.4548 10.9744 20.2856 11.9998 20.2856Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartVerticalDownward2.displayName = 'BarChartVerticalDownward2'

export default BarChartVerticalDownward2
