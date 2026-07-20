// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.1803 14.875C7.80481 14.875 4.92578 15.3853 4.92578 17.428C4.92578 19.4707 7.78838 19.9991 11.1803 19.9991" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.1757 7.99553C15.1757 10.2017 13.3873 11.9911 11.1802 11.9911C8.97402 11.9911 7.18555 10.2017 7.18555 7.99553C7.18555 5.78934 8.97402 4 11.1802 4C13.3873 4 15.1757 5.78934 15.1757 7.99553Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.9825 17.3157C13.6893 16.399 14.0318 15.3525 14.9935 15.0429C15.4994 14.8812 16.0529 14.9737 16.4775 15.2928C16.903 14.9772 17.4539 14.8838 17.9598 15.0429C18.9207 15.3525 19.2666 16.399 18.9734 17.3157C18.5168 18.7669 16.4775 19.886 16.4775 19.886C16.4775 19.886 14.4547 18.7842 13.9825 17.3157Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserLove.displayName = 'UserLove'

export default UserLove
