// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload7 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 15V15.0798C3 17.1521 3 18.1883 3.40328 18.9798C3.75801 19.676 4.32404 20.242 5.02024 20.5967C5.81171 21 6.84781 21 8.92 21H15.08C17.1522 21 18.1883 21 18.9798 20.5967C19.676 20.242 20.242 19.676 20.5967 18.9798C21 18.1883 21 17.1521 21 15.0798V15" stroke="currentColor"></path>
<path d="M7.78125 7.34418L11.9997 2.9999M11.9997 2.9999L16.2182 7.34418M11.9997 2.9999L12.0002 15.5508" stroke="currentColor"></path>
    </svg>
  ),
)

Upload7.displayName = 'Upload7'

export default Upload7
