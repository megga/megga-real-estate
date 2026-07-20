// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GraphChart = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.4829 14.0508C12.4829 13.1595 13.2058 12.4366 14.0971 12.4366C14.9893 12.4366 15.7113 13.1595 15.7113 14.0508C15.7113 14.943 14.9893 15.665 14.0971 15.665C13.2097 15.6689 12.4868 14.9518 12.4829 14.0644V14.0508Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.8119 8.51297C10.8119 9.40423 10.089 10.1272 9.19769 10.1272C8.30546 10.1272 7.5835 9.40423 7.5835 8.51297C7.5835 7.62073 8.30546 6.89877 9.19769 6.89877C10.089 6.89877 10.8119 7.62073 10.8119 8.51297Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.6088 8.51297C20.6088 9.40423 19.8858 10.1272 18.9946 10.1272C18.1023 10.1272 17.3804 9.40423 17.3804 8.51297C17.3804 7.62073 18.1023 6.89877 18.9946 6.89877C19.8858 6.89877 20.6088 7.62073 20.6088 8.51297Z" stroke="currentColor"></path>
<path d="M17.8735 9.66953L15.1929 12.8687" stroke="currentColor"></path>
<path d="M5.31445 13.0539L8.10597 9.69614" stroke="currentColor"></path>
<path d="M12.9994 12.8751L10.2954 9.69247" stroke="currentColor"></path>
<path d="M19.8896 20.251H5.88965C4.78508 20.251 3.88965 19.3556 3.88965 18.251V15.9438" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.83679 14.2332C5.83679 15.1254 5.11385 15.8474 4.22259 15.8474C3.33036 15.8474 2.6084 15.1254 2.6084 14.2332C2.6084 13.3409 3.33036 12.619 4.22259 12.619C5.11385 12.619 5.83679 13.3409 5.83679 14.2332Z" stroke="currentColor"></path>
<path d="M3.88965 4.25098V12.4428" stroke="currentColor"></path>
    </svg>
  ),
)

GraphChart.displayName = 'GraphChart'

export default GraphChart
