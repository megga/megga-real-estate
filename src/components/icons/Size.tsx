// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Size = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.9334 7.54511C18.9334 4.93754 17.3095 3.0957 14.699 3.0957H7.23341C4.63168 3.0957 3 4.93754 3 7.54511V14.5797C3 17.1873 4.62389 19.0291 7.23341 19.0291" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.4792 11.418H14.0337C12.4847 11.418 11.5137 12.5145 11.5137 14.0674V18.2551C11.5137 19.8079 12.4798 20.9045 14.0337 20.9045H18.4792C20.033 20.9045 21.0002 19.8079 21.0002 18.2551V14.0674C21.0002 12.5145 20.033 11.418 18.4792 11.418Z" stroke="currentColor"></path>
    </svg>
  ),
)

Size.displayName = 'Size'

export default Size
