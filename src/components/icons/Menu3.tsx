// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Menu3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0613 20.0197H6.10768C4.39135 20.0197 3 18.6284 3 16.9121V7.08795C3 5.37162 4.39135 3.98027 6.10768 3.98027H12.0613C13.7776 3.98027 15.169 5.37162 15.169 7.08795V16.9121C15.169 18.6284 13.7776 20.0197 12.0613 20.0197Z" stroke="currentColor"></path>
<path d="M18.082 6.54297V17.4578" stroke="currentColor"></path>
<path d="M21 8.92188V15.0769" stroke="currentColor"></path>
    </svg>
  ),
)

Menu3.displayName = 'Menu3'

export default Menu3
