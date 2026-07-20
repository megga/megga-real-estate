// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VolumeUp2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.418 5.37512C22.1894 9.36486 22.1985 14.6276 19.418 18.6252" stroke="currentColor"></path>
<path d="M16.6973 7.99512C18.1224 10.4847 18.1224 13.525 16.6973 16.0068" stroke="currentColor"></path>
<path d="M7.3823 15.9363H3.0014C2.99925 13.3122 2.99925 10.688 3.0014 8.06378H7.3823L11.5082 4.4873H12.2838V19.5127H11.5082L7.3823 15.9363Z" stroke="currentColor"></path>
    </svg>
  ),
)

VolumeUp2.displayName = 'VolumeUp2'

export default VolumeUp2
