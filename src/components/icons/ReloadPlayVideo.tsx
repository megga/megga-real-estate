// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ReloadPlayVideo = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.2642 3.27734L19.4652 6.68434L16.0762 6.88334" stroke="currentColor"></path>
<path d="M21 12.0047C20.996 14.8587 19.628 17.6667 17.093 19.4107C13.003 22.2247 7.403 21.1957 4.583 17.0977C1.77 13.0067 2.806 7.40075 6.897 4.58775C10.928 1.81475 16.416 2.77075 19.281 6.70075" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.8263 13.1843C13.9963 13.9423 12.9593 14.6243 11.8183 15.0893C10.8473 15.4753 10.0333 14.9933 9.91427 14.0273C9.76927 12.6033 9.77227 11.2403 9.91427 9.96833C10.0443 8.96433 10.9403 8.53833 11.8183 8.91033C12.9413 9.37533 13.9503 10.0053 14.8263 10.8153C15.5753 11.5003 15.5923 12.4733 14.8263 13.1843Z" stroke="currentColor"></path>
    </svg>
  ),
)

ReloadPlayVideo.displayName = 'ReloadPlayVideo'

export default ReloadPlayVideo
