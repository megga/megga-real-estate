// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DocumentBarChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.04403 21C5.9716 20.9543 4.32825 19.237 4.37398 17.1646V6.65744C4.42263 4.61809 6.09419 2.99226 8.13451 3.00101H13.7855C14.344 3.00101 14.8782 3.22771 15.2644 3.63052L19.0561 7.57981C19.4219 7.96219 19.6272 8.47106 19.6272 8.99938V17.1646C19.6409 19.2195 18.0238 20.9173 15.9698 21.001M8.04403 21C8.07419 21 8.10435 21.001 8.13451 21.001H15.9698M8.04403 21C8.07419 21 15.9698 21.001 15.9698 21.001" stroke="currentColor"></path>
<path d="M14.2695 3.06348V5.95612C14.2686 7.3679 15.4118 8.51309 16.8236 8.51601H19.5625" stroke="currentColor"></path>
<path d="M14.8291 15.6543V11.9577" stroke="currentColor"></path>
<path d="M9.17044 15.6543V10.6028" stroke="currentColor"></path>
<path d="M12.0004 15.6543V13.7678" stroke="currentColor"></path>
    </svg>
  ),
)

DocumentBarChart.displayName = 'DocumentBarChart'

export default DocumentBarChart
