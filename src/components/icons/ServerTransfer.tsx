// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerTransfer = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9999 11.352V7.78214C20.9999 4.8428 18.9187 3 15.9736 3H8.02635C5.08118 3 3 4.83404 3 7.78214V16.2158C3 19.1649 5.08118 20.9999 8.02635 20.9999H11.1087" stroke="currentColor"></path>
<path d="M7.36328 16.1357H7.88576" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88576M12.1017 7.86523H16.6357" stroke="currentColor"></path>
<path d="M12.2199 12H3.02344" stroke="currentColor"></path>
<path d="M13.1855 16.4316L15.3786 14.8438V20.9997" stroke="currentColor"></path>
<path d="M20.9997 19.4128L18.8066 20.9997V14.8447" stroke="currentColor"></path>
    </svg>
  ),
)

ServerTransfer.displayName = 'ServerTransfer'

export default ServerTransfer
