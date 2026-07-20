// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FaceIDFail = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.0004 16.1523V17.7303C21.0004 19.8793 19.2574 21.6223 17.1074 21.6223H15.8184" stroke="currentColor"></path>
<path d="M3 16.1523V17.7293C3 19.8783 4.74301 21.6213 6.89301 21.6213H8.14999" stroke="currentColor"></path>
<path d="M3 9.09109V7.51309C3 5.36409 4.74301 3.62109 6.89301 3.62109H8.18201" stroke="currentColor"></path>
<path d="M20.9996 9.09109V7.51309C20.9996 5.36409 19.2566 3.62109 17.1066 3.62109H15.8496" stroke="currentColor"></path>
<path d="M8.56055 8.24219V8.85419M15.4385 8.24219V8.85419V8.24219Z" stroke="currentColor"></path>
<path d="M8.56055 16.9998C10.8755 15.0968 13.1685 15.0598 15.4385 16.9998" stroke="currentColor"></path>
<path d="M12.4687 9.5575V11.5283C12.4687 12.0511 12.3057 12.385 11.8595 12.6574L11.5547 12.8555" stroke="currentColor"></path>
    </svg>
  ),
)

FaceIDFail.displayName = 'FaceIDFail'

export default FaceIDFail
