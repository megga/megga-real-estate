// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DocumentCharts2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.96332 21.001H16.037C18.3119 21.001 20.1566 19.1562 20.1566 16.8814V7.12054C20.1566 4.84573 18.3119 3.00098 16.037 3.00098H7.96332C5.68851 3.00098 3.84375 4.84573 3.84375 7.12054V16.8814C3.84375 19.1562 5.68851 21.001 7.96332 21.001Z" stroke="currentColor"></path>
<path d="M15.9868 17.1002V12.6742" stroke="currentColor"></path>
<path d="M10.6377 17.0999V12.9266" stroke="currentColor"></path>
<path d="M13.3124 17.1004V15.2594" stroke="currentColor"></path>
<path d="M7.88514 17.1004V15.2594" stroke="currentColor"></path>
<path d="M7.66699 10.5799L10.3342 7.71285L13.377 9.6888L15.9866 6.90149" stroke="currentColor"></path>
    </svg>
  ),
)

DocumentCharts2.displayName = 'DocumentCharts2'

export default DocumentCharts2
