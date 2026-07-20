// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownGraphCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.0005C21 16.9704 16.9709 21.0005 12 21.0005C7.02908 21.0005 3 16.9704 3 12.0005C3 7.02957 7.02908 3.00049 12 3.00049C16.9709 3.00049 21 7.02957 21 12.0005Z" stroke="currentColor"></path>
<path d="M11.6221 14.375L14.9009 15.0251L15.5506 11.746" stroke="currentColor"></path>
<path d="M14.9003 15.0251L10.7383 8.80571L7.46491 10.9965L4.52734 7.02508" stroke="currentColor"></path>
    </svg>
  ),
)

DownGraphCircle.displayName = 'DownGraphCircle'

export default DownGraphCircle
