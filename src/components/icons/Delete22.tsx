// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Delete22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M4.36938 6.58972H20.1306L18.7132 21.3888H5.78678L4.36938 6.58972Z" stroke="currentColor"></path>
<path d="M16.727 6.13589L15.6583 2.88855H8.84339L7.77466 6.13589" stroke="currentColor"></path>
<path d="M12.2512 11.5023L12.2512 16.4752" stroke="currentColor"></path>
    </svg>
  ),
)

Delete22.displayName = 'Delete22'

export default Delete22
