// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlowChart = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8.5 6.51569L8.5 4.98425C8.5 4.16502 9.162 3.50049 9.97909 3.50049L14.0219 3.50049C14.839 3.50049 15.5 4.16502 15.5 4.98425V6.51569C15.5 7.3359 14.839 8.00043 14.0219 8.00043H9.97909C9.162 8.00043 8.5 7.3359 8.5 6.51569Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3 19.0157L3 17.4843C3 16.665 3.662 16.0005 4.47909 16.0005L8.52188 16.0005C9.33897 16.0005 10 16.665 10 17.4843V19.0157C10 19.8359 9.33897 20.5004 8.52188 20.5004H4.47909C3.662 20.5004 3 19.8359 3 19.0157Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14 19.0157L14 17.4843C14 16.665 14.662 16.0005 15.4791 16.0005L19.5219 16.0005C20.339 16.0005 21 16.665 21 17.4843V19.0157C21 19.8359 20.339 20.5004 19.5219 20.5004H15.4791C14.662 20.5004 14 19.8359 14 19.0157Z" stroke="currentColor"></path>
<path d="M12 8.00049L12 12.0005" stroke="currentColor"></path>
<path d="M17.5 16.0005V14.0005C17.5 12.8959 16.6046 12.0005 15.5 12.0005H8.5C7.39543 12.0005 6.5 12.8959 6.5 14.0005V16.0005" stroke="currentColor"></path>
    </svg>
  ),
)

FlowChart.displayName = 'FlowChart'

export default FlowChart
