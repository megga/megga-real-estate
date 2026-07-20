// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.475 15.5836C20.0076 15.5836 21.25 16.8148 21.25 18.3336C21.25 19.8524 20.0076 21.0836 18.475 21.0836H5.525C3.99241 21.0836 2.75 19.8524 2.75 18.3336C2.75 16.8148 3.99241 15.5836 5.525 15.5836H7.77049C8.88553 15.5836 9.35601 16.9586 10.5769 16.9586H13.4231C14.644 16.9586 15.1145 15.5836 16.2295 15.5836H18.475Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.5 8.27944L12 2.91638L8.5 8.27944L15.5 8.27944Z" stroke="currentColor"></path>
<path d="M11.998 8.27832L11.998 12.9161" stroke="currentColor"></path>
    </svg>
  ),
)

Upload4.displayName = 'Upload4'

export default Upload4
