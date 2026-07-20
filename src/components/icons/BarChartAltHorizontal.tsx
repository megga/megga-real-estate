// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartAltHorizontal = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0017 4.00112V9.00149L4.00049 9.00149L4.00049 4.00112C4.00049 3.44845 4.44905 3.00085 5.00076 3.00085L11.0014 3.00085C11.5541 3.00085 12.0017 3.44845 12.0017 4.00112Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.0008 20.0002V14.9999L4.00049 14.9999L4.00049 20.0002C4.00049 20.5529 4.44808 21.0005 4.99978 21.0005L15.0005 21.0005C15.5532 21.0005 16.0008 20.5529 16.0008 20.0002Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.0004 14.0012V10.0011C20.0004 9.44845 19.5528 9.00086 19.0001 9.00086L3.99902 9.00085L3.99902 15.0015L19.0001 15.0015C19.5528 15.0015 20.0004 14.5539 20.0004 14.0012Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartAltHorizontal.displayName = 'BarChartAltHorizontal'

export default BarChartAltHorizontal
