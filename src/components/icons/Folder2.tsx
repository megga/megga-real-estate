// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Folder2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M7.88281 15.0865H16.6178" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 20.3265H3V3.67346H9.96326L12.2249 6.45239H21.5V20.3265Z" stroke="currentColor"></path>
    </svg>
  ),
)

Folder2.displayName = 'Folder2'

export default Folder2
