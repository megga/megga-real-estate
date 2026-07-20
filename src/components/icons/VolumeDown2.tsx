// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VolumeDown2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M18.5642 7.99512C19.9894 10.4847 19.9894 13.525 18.5642 16.0068" stroke="currentColor"></path>
<path d="M9.24925 15.9363H4.86834C4.8662 13.3122 4.8662 10.688 4.86834 8.06378H9.24925L13.3751 4.4873H14.1507V19.5127H13.3751L9.24925 15.9363Z" stroke="currentColor"></path>
    </svg>
  ),
)

VolumeDown2.displayName = 'VolumeDown2'

export default VolumeDown2
