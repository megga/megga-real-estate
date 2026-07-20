// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartHorizontalAlt = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.71255 4.85783C3.71255 5.88331 4.54345 6.71517 5.5699 6.71517L13.9051 6.71518C14.9306 6.71518 15.7624 5.88331 15.7624 4.85783C15.7624 3.83235 14.9306 3.00049 13.9051 3.00049L5.5699 3.00049C4.54345 3.00049 3.71255 3.83235 3.71255 4.85783Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71191 19.1431C3.71191 18.1177 4.54281 17.2858 5.56926 17.2858L18.4306 17.2858C19.457 17.2858 20.2889 18.1177 20.2889 19.1431C20.2889 20.1686 19.457 21.0005 18.4306 21.0005H5.56926C4.54281 21.0005 3.71191 20.1686 3.71191 19.1431Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.71094 12.0004C3.71094 13.0259 4.54183 13.8578 5.56828 13.8578L9.1273 13.8578C10.1537 13.8578 10.9846 13.0259 10.9846 12.0004C10.9846 10.9749 10.1537 10.1431 9.1273 10.1431L5.56828 10.1431C4.54183 10.1431 3.71094 10.9749 3.71094 12.0004Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartHorizontalAlt.displayName = 'BarChartHorizontalAlt'

export default BarChartHorizontalAlt
