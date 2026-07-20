// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownChartAlertBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.416 3.79026H7.60484C4.78108 3.79026 3.03174 5.78978 3.03174 8.61161V16.1869C3.03174 19.0097 4.74714 21.0005 7.60484 21.0005H15.666C18.4878 21.0005 20.2391 19.0097 20.2391 16.1869V9.59003" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1669 3.00049C20.1618 3.00049 20.9686 3.80728 20.9686 4.80219C20.9686 5.7971 20.1618 6.60389 19.1669 6.60389C18.172 6.60389 17.3652 5.7971 17.3652 4.80219C17.3652 3.80728 18.172 3.00049 19.1669 3.00049Z" stroke="currentColor"></path>
<path d="M15.9674 14.7193L13.162 11.0742L9.96202 13.5867L7.2168 10.0435" stroke="currentColor"></path>
    </svg>
  ),
)

DownChartAlertBox.displayName = 'DownChartAlertBox'

export default DownChartAlertBox
