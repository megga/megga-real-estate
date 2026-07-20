// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoreCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.46875 14.8472C8.38425 14.8472 9.9375 16.4 9.9375 18.3159C9.9375 20.2314 8.38425 21.7847 6.46875 21.7847C4.55287 21.7847 3 20.2314 3 18.3159C3 16.4004 4.55325 14.8472 6.46875 14.8472Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.0312 14.8472C19.9467 14.8472 21.5 16.4 21.5 18.3159C21.5 20.2314 19.9467 21.7847 18.0312 21.7847C16.1154 21.7847 14.5625 20.2314 14.5625 18.3159C14.5625 16.4004 16.1158 14.8472 18.0312 14.8472Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.25 3.28467C14.1655 3.28467 15.7188 4.83754 15.7188 6.75342C15.7188 8.66892 14.1655 10.2222 12.25 10.2222C10.3341 10.2222 8.78125 8.66892 8.78125 6.75342C8.78125 4.83792 10.3345 3.28467 12.25 3.28467Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoreCircle2.displayName = 'MoreCircle2'

export default MoreCircle2
