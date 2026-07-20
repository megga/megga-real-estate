// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Hide32 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.99902 8.43555C7.19902 15.3685 16.799 15.3685 19.999 8.43555" stroke="currentColor"></path>
<path d="M6.86194 11.9746L4.00293 15.9036" stroke="currentColor"></path>
<path d="M17.1436 11.9746L20.0016 15.9036" stroke="currentColor"></path>
<path d="M11.999 13.6387V17.5047" stroke="currentColor"></path>
    </svg>
  ),
)

Hide32.displayName = 'Hide32'

export default Hide32
