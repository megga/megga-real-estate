// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RemoveUser3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.4342 14.875C8.05872 14.875 5.17969 15.3853 5.17969 17.428C5.17969 19.4707 8.04228 19.9991 11.4342 19.9991" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4316 7.99553C15.4316 10.2017 13.6431 11.9911 11.4361 11.9911C9.22988 11.9911 7.44141 10.2017 7.44141 7.99553C7.44141 5.78934 9.22988 4 11.4361 4C13.6431 4 15.4316 5.78934 15.4316 7.99553Z" stroke="currentColor"></path>
<path d="M18.8212 17.0664H14.8672" stroke="currentColor"></path>
    </svg>
  ),
)

RemoveUser3.displayName = 'RemoveUser3'

export default RemoveUser3
