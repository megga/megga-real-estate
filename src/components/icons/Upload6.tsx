// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.475 15.6235C20.0076 15.6235 21.25 16.8548 21.25 18.3735C21.25 19.8923 20.0076 21.1235 18.475 21.1235H5.525C3.99241 21.1235 2.75 19.8923 2.75 18.3735C2.75 16.8548 3.99241 15.6235 5.525 15.6235H7.77049C8.88553 15.6235 9.35601 16.9985 10.5769 16.9985H13.4231C14.644 16.9985 15.1145 15.6235 16.2295 15.6235H18.475Z" stroke="currentColor"></path>
<path d="M8.04687 6.99392L12.0469 2.87646M12.0469 2.87646L16.0469 6.99392M12.0469 2.87646L12.0473 12.8765" stroke="currentColor"></path>
    </svg>
  ),
)

Upload6.displayName = 'Upload6'

export default Upload6
