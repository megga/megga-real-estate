// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PoundCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M10.7879 11.5514C11.3951 12.2996 11.4466 13.3553 10.9134 14.158C10.5311 14.6542 10.1224 15.129 9.68848 15.5814H14.0853" stroke="currentColor"></path>
<path d="M14.1988 8.77683C13.4204 7.8457 12.0339 7.72116 11.1028 8.49954C10.1891 9.26332 10.05 10.6158 10.7885 11.5498" stroke="currentColor"></path>
<path d="M8.95508 11.917H13.3519" stroke="currentColor"></path>
    </svg>
  ),
)

PoundCircle.displayName = 'PoundCircle'

export default PoundCircle
