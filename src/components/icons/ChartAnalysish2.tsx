// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartAnalysish2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.36011 4.62006H16.6402C18.7175 4.62006 20.4007 6.30328 20.4007 8.38056V13.474C20.4007 15.5503 18.7175 17.2345 16.6402 17.2345H7.36011C5.28284 17.2345 3.59961 15.5503 3.59961 13.474V8.38056C3.59961 6.30328 5.28284 4.62006 7.36011 4.62006Z" stroke="currentColor"></path>
<path d="M12.0015 13.2121V8.23926M15.882 13.2119V10.6375M8.12109 13.2122V9.89634" stroke="currentColor"></path>
<path d="M15.673 20.9998L12.0011 17.2627L8.32812 20.9998" stroke="currentColor"></path>
<path d="M12 3.00098V4.63069" stroke="currentColor"></path>
    </svg>
  ),
)

ChartAnalysish2.displayName = 'ChartAnalysish2'

export default ChartAnalysish2
