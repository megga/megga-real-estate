// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MenuCloseLeft2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2178 3L7.78313 3C4.83503 3 3 5.08119 3 8.02638V15.9736C3 18.9188 4.83503 21 7.78411 21H16.2178C19.1659 21 21 18.9188 21 15.9736V8.02638C21 5.08119 19.1572 3 16.2178 3Z" stroke="currentColor"></path>
<path d="M10 9L7 12.0018L10 15" stroke="currentColor"></path>
<path d="M15 3.06641L15 20.9414" stroke="currentColor"></path>
    </svg>
  ),
)

MenuCloseLeft2.displayName = 'MenuCloseLeft2'

export default MenuCloseLeft2
