// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.2497 3.23101L12.2497 16.0088" stroke="currentColor"></path>
<path d="M8.9751 5.771L12.2501 2.48143L15.5261 5.771" stroke="currentColor"></path>
<path d="M16.875 10.9946L21.5 10.9946L21.5 21.5186L3 21.5186L3 10.9946L7.625 10.9946" stroke="currentColor"></path>
    </svg>
  ),
)

Upload2.displayName = 'Upload2'

export default Upload2
