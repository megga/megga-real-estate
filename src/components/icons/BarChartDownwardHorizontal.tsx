// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartDownwardHorizontal = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0007 20.0003V15L3.99951 15L3.99951 20.0003C3.99951 20.553 4.44808 21.0006 4.99978 21.0006L11.0004 21.0006C11.5531 21.0006 12.0007 20.553 12.0007 20.0003Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.0008 14.0003V8.99997L4.00049 8.99997L4.00049 15.0006L15.0005 15.0006C15.5532 15.0006 16.0008 14.553 16.0008 14.0003Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.0009 8.00132V4.00122C20.0009 3.44854 19.5533 3.00095 19.0006 3.00095L4.99978 3.00095C4.44808 3.00095 3.99951 3.44854 3.99951 4.00121L3.99951 9.00158L19.0006 9.00158C19.5533 9.00158 20.0009 8.55399 20.0009 8.00132Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartDownwardHorizontal.displayName = 'BarChartDownwardHorizontal'

export default BarChartDownwardHorizontal
