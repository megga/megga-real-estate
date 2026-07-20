// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LogOut4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.9403 4.68959C13.7449 3.97152 12.3571 3.56055 10.8769 3.56055C6.38852 3.56055 2.75 7.33901 2.75 12C2.75 16.6609 6.38852 20.4394 10.8769 20.4394C12.3571 20.4394 13.7449 20.0284 14.9403 19.3104" stroke="currentColor"></path>
<path d="M17.5078 8.24902L21.2509 11.9921M21.2509 11.9921L17.5078 15.7351M21.2509 11.9921H9.08594" stroke="currentColor"></path>
    </svg>
  ),
)

LogOut4.displayName = 'LogOut4'

export default LogOut4
