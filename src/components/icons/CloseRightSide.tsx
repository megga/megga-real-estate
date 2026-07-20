// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CloseRightSide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 21H16.2169C19.165 21 21 18.9188 21 15.9736V8.02638C21 5.08119 19.165 3 16.2159 3H7.78216C4.83405 3 3 5.08119 3 8.02638V15.9736C3 18.9188 4.84281 21 7.78216 21Z" stroke="currentColor"></path>
<path d="M16.4681 10.1289L12.7231 13.8739M12.7227 10.1289L16.4676 13.8739" stroke="currentColor"></path>
<path d="M8.54199 21V3" stroke="currentColor"></path>
    </svg>
  ),
)

CloseRightSide.displayName = 'CloseRightSide'

export default CloseRightSide
