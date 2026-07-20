// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoChat = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.2082 20.1644C11.5397 21.7056 15.6145 21.1111 18.3642 18.3605C21.8757 14.849 21.8815 9.1512 18.3642 5.63289C14.8527 2.12237 9.1481 2.12237 5.6366 5.63289C2.88695 8.38351 2.29149 12.4574 3.83366 15.7899C4.03118 16.2822 4.18491 16.6782 4.18491 17.0625C4.18491 18.1367 3.14868 19.4668 3.8395 20.1576C4.53032 20.8484 5.86039 19.8122 6.92872 19.8063C7.31208 19.8063 7.71587 19.9659 8.2082 20.1644Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.5181 13.0931C13.7455 13.7927 12.7803 14.4222 11.7169 14.8503C10.813 15.2064 10.056 14.7618 9.94409 13.8715C9.80885 12.557 9.81177 11.2999 9.94409 10.1255C10.0657 9.20022 10.9005 8.80616 11.7169 9.15059C12.7638 9.57871 13.7018 10.1606 14.5181 10.9078C15.2147 11.5393 15.2313 12.4364 14.5181 13.0931Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoChat.displayName = 'VideoChat'

export default VideoChat
