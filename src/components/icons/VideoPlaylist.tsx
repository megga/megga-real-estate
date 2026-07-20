// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoPlaylist = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.55 17.6845V12.5278C20.55 10.6986 19.0663 9.21484 17.2371 9.21484H6.76314C4.93299 9.21484 3.44922 10.6986 3.44922 12.5278V17.6845C3.44922 19.5146 4.93299 20.9984 6.76314 20.9984H17.2371C19.0663 20.9984 20.55 19.5146 20.55 17.6845Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.9894 15.9514C13.3852 16.4982 12.6312 16.9905 11.8003 17.3252C11.0929 17.6035 10.5013 17.2561 10.4147 16.5595C10.3087 15.532 10.3106 14.5493 10.4147 13.6318C10.5091 12.908 11.162 12.6005 11.8003 12.87C12.6175 13.2047 13.3512 13.6591 13.9894 14.2438C14.5343 14.7371 14.5469 15.4386 13.9894 15.9514Z" stroke="currentColor"></path>
<path d="M6.18164 6.11328H17.8183" stroke="currentColor"></path>
<path d="M8.71875 3H15.2804" stroke="currentColor"></path>
    </svg>
  ),
)

VideoPlaylist.displayName = 'VideoPlaylist'

export default VideoPlaylist
