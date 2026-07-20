// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SubtitleExplore = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9906 11.3856V8.41623C20.9993 5.39916 19.1761 3.75781 16.2329 3.75781H7.77423C4.83985 3.75781 3.00781 5.39916 3.00781 8.41623V15.4992C3.00781 18.563 4.83985 20.2423 7.77423 20.2423H11.9987" stroke="currentColor"></path>
<path d="M20.9993 8.57422H3" stroke="currentColor"></path>
<path d="M12.1558 12.375H11.6207M7.20312 15.8316H9.41364M8.91602 12.375H7.26203" stroke="currentColor"></path>
<path d="M19.5316 18.7791L20.9998 20.2434M17.5467 13.7266C19.157 13.7266 20.4626 15.0322 20.4626 16.6434C20.4626 18.2536 19.157 19.5593 17.5467 19.5593C15.9365 19.5593 14.6309 18.2536 14.6309 16.6434C14.6309 15.0322 15.9365 13.7266 17.5467 13.7266Z" stroke="currentColor"></path>
    </svg>
  ),
)

SubtitleExplore.displayName = 'SubtitleExplore'

export default SubtitleExplore
