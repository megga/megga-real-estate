// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpChartAlertBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.4141 3.79026H7.60289C4.77912 3.79026 3.02979 5.78978 3.02979 8.61161V16.1869C3.02979 19.0097 4.74518 21.0005 7.60289 21.0005H15.664C18.4858 21.0005 20.2371 19.0097 20.2371 16.1869V9.59003" stroke="currentColor"></path>
<path d="M7.21484 14.7193L10.0202 11.0742L13.2202 13.5867L15.9654 10.0435" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1689 3.00049C20.1638 3.00049 20.9706 3.80728 20.9706 4.80219C20.9706 5.7971 20.1638 6.60389 19.1689 6.60389C18.174 6.60389 17.3672 5.7971 17.3672 4.80219C17.3672 3.80728 18.174 3.00049 19.1689 3.00049Z" stroke="currentColor"></path>
    </svg>
  ),
)

UpChartAlertBox.displayName = 'UpChartAlertBox'

export default UpChartAlertBox
