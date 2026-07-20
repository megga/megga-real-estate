// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownChartCircleAlert = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.3751 14.3385L13.5697 10.6934L10.3697 13.2059L7.62451 9.6626" stroke="currentColor"></path>
<path d="M14.0702 3.23975C13.4056 3.08327 12.7125 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005C21 11.2537 20.909 10.5281 20.7376 9.83428" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1982 3.00049C20.1931 3.00049 20.9999 3.80728 20.9999 4.80219C20.9999 5.7971 20.1931 6.60389 19.1982 6.60389C18.2033 6.60389 17.3965 5.7971 17.3965 4.80219C17.3965 3.80728 18.2033 3.00049 19.1982 3.00049Z" stroke="currentColor"></path>
    </svg>
  ),
)

DownChartCircleAlert.displayName = 'DownChartCircleAlert'

export default DownChartCircleAlert
