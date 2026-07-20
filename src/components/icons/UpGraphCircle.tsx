// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpGraphCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.0005C21 7.03054 16.9709 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005Z" stroke="currentColor"></path>
<path d="M11.6221 9.62633L14.9009 8.97625L15.5506 12.2553" stroke="currentColor"></path>
<path d="M14.9003 8.97625L10.7383 15.1956L7.46491 13.0048L4.52734 16.9762" stroke="currentColor"></path>
    </svg>
  ),
)

UpGraphCircle.displayName = 'UpGraphCircle'

export default UpGraphCircle
