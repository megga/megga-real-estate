// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78221 3H16.2168C19.1645 3 21 5.08177 21 8.02655V15.9744C21 18.9192 19.1645 21 16.2158 21H7.78221C4.83352 21 3 18.9192 3 15.9744V8.02655C3 5.08177 4.84232 3 7.78221 3Z" stroke="currentColor"></path>
<path d="M14.1744 10.2922V10.214C14.1744 9.46534 13.5675 8.85742 12.8188 8.85742H11.4623C10.5582 8.85742 9.82422 9.59142 9.82422 10.4955C9.82422 11.4005 10.5582 12.1335 11.4623 12.1335H12.6009C13.4698 12.1335 14.1754 12.8382 14.1754 13.708C14.1754 14.5779 13.4698 15.2826 12.6009 15.2826H11.1808C10.4321 15.2826 9.8252 14.6747 9.8252 13.926" stroke="currentColor"></path>
<path d="M12 16.2865V15.2876M12 8.85346V7.7207" stroke="currentColor"></path>
    </svg>
  ),
)

DollarSquare2.displayName = 'DollarSquare2'

export default DollarSquare2
