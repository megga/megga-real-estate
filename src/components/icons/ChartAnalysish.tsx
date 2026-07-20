// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartAnalysish = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.3601 4.62006H16.6402C18.7175 4.62006 20.4007 6.30328 20.4007 8.38055V13.474C20.4007 15.5503 18.7175 17.2345 16.6402 17.2345H7.3601C5.28283 17.2345 3.59961 15.5503 3.59961 13.474V8.38055C3.59961 6.30328 5.28283 4.62006 7.3601 4.62006Z" stroke="currentColor"></path>
<path d="M12 3.00098V4.63068" stroke="currentColor"></path>
<path d="M8.03711 12.8083L10.7419 10.1045L12.8241 12.1866L15.9638 9.04785" stroke="currentColor"></path>
<path d="M15.673 21.0028L12.001 17.2627L8.32812 21.0028" stroke="currentColor"></path>
    </svg>
  ),
)

ChartAnalysish.displayName = 'ChartAnalysish'

export default ChartAnalysish
