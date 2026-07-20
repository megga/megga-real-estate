// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeft33 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.3 11.8939L20.25 11.8939" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.64613 11.8998C3.64613 13.1558 10.0101 17.1708 10.7321 16.4488C11.4541 15.7268 11.5231 8.14181 10.7321 7.35081C9.94014 6.55981 3.64613 10.6448 3.64613 11.8998Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowLeft33.displayName = 'ArrowLeft33'

export default ArrowLeft33
