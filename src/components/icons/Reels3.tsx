// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Reels3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.65173 3H16.3476C19.0085 3 20.6644 4.87817 20.6644 7.53606V16.4639C20.6644 19.1218 19.0085 21 16.3467 21H7.65173C4.99091 21 3.33594 19.1218 3.33594 16.4639V7.53606C3.33594 4.87817 4.99871 3 7.65173 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2777 15.2917C13.5516 15.9496 12.6451 16.5403 11.6471 16.9428C10.7972 17.2781 10.0857 16.8599 9.98139 16.0227C9.85371 14.7888 9.85663 13.6065 9.98139 12.5042C10.0954 11.6348 10.879 11.2654 11.6471 11.588C12.6295 11.9905 13.5116 12.5373 14.2777 13.2391C14.9327 13.8327 14.9482 14.6757 14.2777 15.2917Z" stroke="currentColor"></path>
<path d="M20.5516 8.20703H3.44727" stroke="currentColor"></path>
<path d="M8.14866 8.20171L6.76172 3.07696M12.4247 8.20176L10.9764 3.00391M16.7098 8.20176L15.2614 3.00391" stroke="currentColor"></path>
    </svg>
  ),
)

Reels3.displayName = 'Reels3'

export default Reels3
