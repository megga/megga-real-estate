// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoScan = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.3373 8.1875H8.76428C7.51928 8.1875 6.73828 9.0695 6.73828 10.3165V13.6835C6.73828 14.9315 7.51528 15.8125 8.76428 15.8125H12.3373C13.5863 15.8125 14.3633 14.9315 14.3633 13.6835V10.3165C14.3633 9.0695 13.5863 8.1875 12.3373 8.1875Z" stroke="currentColor"></path>
<path d="M14.3594 10.9412L16.1524 9.47418C16.4424 9.23618 16.8704 9.27918 17.1084 9.56918C17.2074 9.69118 17.2624 9.84318 17.2624 10.0012L17.2554 14.0012C17.2544 14.3762 16.9494 14.6792 16.5744 14.6782C16.4184 14.6782 16.2664 14.6242 16.1444 14.5242L14.3594 13.0582" stroke="currentColor"></path>
<path d="M3 8.47V6.893C3 4.743 4.743 3 6.893 3H8.182" stroke="currentColor"></path>
<path d="M3 15.5312V17.1082C3 19.2582 4.743 21.0002 6.893 21.0002H8.15" stroke="currentColor"></path>
<path d="M21.0004 15.5312V17.1082C21.0004 19.2582 19.2574 21.0002 17.1074 21.0002H15.8184" stroke="currentColor"></path>
<path d="M20.9996 8.47V6.893C20.9996 4.743 19.2566 3 17.1066 3H15.8496" stroke="currentColor"></path>
    </svg>
  ),
)

VideoScan.displayName = 'VideoScan'

export default VideoScan
