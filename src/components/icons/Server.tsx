// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Server = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 6.89189V17.1081C21 19.2575 19.2575 21 17.1081 21H6.89189C4.74246 21 3 19.2575 3 17.1081V6.89189C3 4.74246 4.74246 3 6.89189 3H17.1081C19.2575 3 21 4.74246 21 6.89189Z" stroke="currentColor"></path>
<path d="M20.9893 8.98926H3" stroke="currentColor"></path>
<path d="M20.9885 15.0322H3.03516" stroke="currentColor"></path>
<path d="M7.31055 5.98145H7.83303M13.022 5.98145H16.583" stroke="currentColor"></path>
<path d="M7.31055 18.0186H7.83303M13.022 18.0186H16.583" stroke="currentColor"></path>
<path d="M7.31055 12.0859H7.83303M13.022 12.0859H16.583" stroke="currentColor"></path>
    </svg>
  ),
)

Server.displayName = 'Server'

export default Server
