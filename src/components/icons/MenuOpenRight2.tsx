// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MenuOpenRight2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3L16.2169 3C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736L3 8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M14 9L17 12.0018L14 15" stroke="currentColor"></path>
<path d="M9 3.06641L9 20.9414" stroke="currentColor"></path>
    </svg>
  ),
)

MenuOpenRight2.displayName = 'MenuOpenRight2'

export default MenuOpenRight2
