// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MindMap = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.9815" cy="11.8301" r="2.73488" stroke="currentColor"></circle>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(1 0 0 -1 10.5703 21.0005)" stroke="currentColor"></circle>
<path d="M12.0029 18.1406L12.0029 14.9058" stroke="currentColor"></path>
<circle cx="12.0003" cy="4.43049" r="1.43" stroke="currentColor"></circle>
<path d="M12.0029 5.86035L12.0029 9.09522" stroke="currentColor"></path>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(-4.37114e-08 1 1 4.37114e-08 3 10.5703)" stroke="currentColor"></circle>
<path d="M5.86035 12.0034L9.09522 12.0034" stroke="currentColor"></path>
<circle cx="19.57" cy="12.0003" r="1.43" transform="rotate(90 19.57 12.0003)" stroke="currentColor"></circle>
<path d="M18.1401 12.0034L14.9053 12.0034" stroke="currentColor"></path>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(0.707107 0.707107 0.707107 -0.707107 4.625 17.353)" stroke="currentColor"></circle>
<path d="M7.66113 16.3438L9.94853 14.0564" stroke="currentColor"></path>
<circle cx="17.3525" cy="6.64733" r="1.43" transform="rotate(45 17.3525 6.64733)" stroke="currentColor"></circle>
<path d="M16.3438 7.66113L14.0564 9.94853" stroke="currentColor"></path>
<circle cx="1.43" cy="1.43" r="1.43" transform="matrix(-0.707107 0.707107 0.707107 0.707107 6.64746 4.625)" stroke="currentColor"></circle>
<path d="M7.65625 7.66113L9.94365 9.94853" stroke="currentColor"></path>
<circle cx="17.3527" cy="17.353" r="1.43" transform="rotate(135 17.3527 17.353)" stroke="currentColor"></circle>
<path d="M16.3394 16.3442L14.052 14.0568" stroke="currentColor"></path>
    </svg>
  ),
)

MindMap.displayName = 'MindMap'

export default MindMap
