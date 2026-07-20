// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartUpwardHorizontall = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0017 4.00112V9.00149L4.00049 9.00149L4.00049 4.00112C4.00049 3.44845 4.44905 3.00085 5.00076 3.00085L11.0014 3.00085C11.5541 3.00085 12.0017 3.44845 12.0017 4.00112Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.0008 10.0011V15.0015L4.00049 15.0015L4.00049 9.00085L15.0005 9.00085C15.5532 9.00085 16.0008 9.44845 16.0008 10.0011Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.0004 16.0001V20.0002C20.0004 20.5529 19.5528 21.0005 19.0001 21.0005L4.99929 21.0005C4.44759 21.0005 3.99902 20.5529 3.99902 20.0002L3.99902 14.9999L19.0001 14.9999C19.5528 14.9999 20.0004 15.4475 20.0004 16.0001Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartUpwardHorizontall.displayName = 'BarChartUpwardHorizontall'

export default BarChartUpwardHorizontall
