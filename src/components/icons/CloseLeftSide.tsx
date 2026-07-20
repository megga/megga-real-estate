// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CloseLeftSide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2178 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.83503 3 7.78411 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1572 21 16.2178 21Z" stroke="currentColor"></path>
<path d="M15.458 21V3" stroke="currentColor"></path>
<path d="M7.53125 10.1289L11.2762 13.8739M11.2767 10.1289L7.53172 13.8739" stroke="currentColor"></path>
    </svg>
  ),
)

CloseLeftSide.displayName = 'CloseLeftSide'

export default CloseLeftSide
