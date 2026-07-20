// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.4807 21.2705H7.88862C5.61316 21.2705 3.76953 19.4255 3.76953 17.1505V7.3895C3.76953 5.1155 5.61316 3.27051 7.88862 3.27051H14.9847C17.2601 3.27051 19.1047 5.1155 19.1047 7.3895V10.7545" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.8311 21.2707H16.0104C15.2376 21.2707 14.6113 20.6447 14.6113 19.8707V18.2877C14.6113 17.5157 15.2376 16.8877 16.0104 16.8877H18.8311C19.6039 16.8877 20.2311 17.5157 20.2311 18.2877V19.8707C20.2311 20.6447 19.6039 21.2707 18.8311 21.2707Z" stroke="currentColor"></path>
<path d="M19.1051 16.9131V15.8711C19.0934 14.9411 18.3303 14.1971 17.4012 14.2081C16.4906 14.2201 15.754 14.9531 15.7383 15.8631V16.9131" stroke="currentColor"></path>
<path d="M9.85205 8.73901L9.85205 8.75316" stroke="currentColor"></path>
<path d="M11.5269 15.9872L11.5273 11.9587C11.7148 11.8386 11.8929 11.7068 12.0568 11.5429C13.2813 10.3184 13.2813 8.33306 12.0568 7.10854C10.8323 5.88403 8.84694 5.88403 7.62243 7.10854C6.39792 8.33305 6.39792 10.3184 7.62243 11.5429C7.86017 11.7806 8.12749 11.9731 8.41144 12.1185L8.41244 13.0305L8.94261 13.5607L8.13416 14.3691L8.95592 15.1909L8.43004 15.7168C8.28127 15.8655 8.28127 16.1067 8.43004 16.2555L9.65382 17.4793C9.8026 17.6281 10.0438 17.6281 10.1926 17.4793L11.4154 16.2565C11.4868 16.1851 11.5269 16.0882 11.5269 15.9872Z" stroke="currentColor"></path>
    </svg>
  ),
)

Key.displayName = 'Key'

export default Key
