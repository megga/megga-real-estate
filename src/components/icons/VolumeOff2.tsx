// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VolumeOff2 = forwardRef<SVGSVGElement, Props>(
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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8.04432 15.9363H3.66342C3.66127 13.3122 3.66127 10.688 3.66342 8.06378H8.04432L12.1702 4.4873H12.9458V19.5127H12.1702L8.04432 15.9363Z" stroke="currentColor"></path>
<path d="M20.837 13.7331L17.371 10.2671" stroke="currentColor"></path>
<path d="M17.372 13.7331L20.838 10.2671" stroke="currentColor"></path>
    </svg>
  ),
)

VolumeOff2.displayName = 'VolumeOff2'

export default VolumeOff2
