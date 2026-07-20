// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartHorizontalUpward = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.71238 19.1428C3.71238 20.1682 4.54323 21 5.56962 21H9.12845C10.1548 21 10.9857 20.1682 10.9857 19.1428C10.9857 18.1173 10.1548 17.2855 9.12845 17.2855H5.56962C4.54323 17.2855 3.71238 18.1173 3.71238 19.1428Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71191 4.85725C3.71191 5.88267 4.54276 6.71449 5.56916 6.71449L18.4298 6.71449C19.4562 6.71449 20.288 5.88267 20.288 4.85725C20.288 3.83182 19.4562 3 18.4298 3L5.56916 3C4.54276 3 3.71191 3.83182 3.71191 4.85725Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71436 11.9998C3.71436 13.0252 4.5452 13.8571 5.5716 13.8571L12.8566 13.8571C13.883 13.8571 14.7148 13.0252 14.7148 11.9998C14.7148 10.9744 13.883 10.1426 12.8566 10.1426L5.5716 10.1426C4.5452 10.1426 3.71436 10.9744 3.71436 11.9998Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartHorizontalUpward.displayName = 'BarChartHorizontalUpward'

export default BarChartHorizontalUpward
