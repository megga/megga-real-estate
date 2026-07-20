// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M16.875 11.3394L21.5 11.3394L21.5 21.8633L3 21.8633L3 11.3394L7.625 11.3394" stroke="currentColor"></path>
<path d="M12.251 2.41406L12.251 16.3533" stroke="currentColor"></path>
<path d="M7.65547 7.00977C10.0179 7.00977 12.251 4.92916 12.251 2.41426" stroke="currentColor"></path>
<path d="M16.8465 7.00977C14.484 7.00977 12.251 4.92916 12.251 2.41426" stroke="currentColor"></path>
    </svg>
  ),
)

Upload22.displayName = 'Upload22'

export default Upload22
