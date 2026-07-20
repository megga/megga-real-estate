// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarSquare = forwardRef<SVGSVGElement, Props>(
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
<path d="M14.6518 10.214C14.6518 9.46534 14.0448 8.85742 13.2962 8.85742H10.9886C10.0836 8.85742 9.34961 9.59142 9.34961 10.4955C9.35059 11.4005 10.0836 12.1335 10.9886 12.1335H13.0782C13.9481 12.1335 14.6528 12.8382 14.6528 13.708C14.6528 14.5779 13.9481 15.2826 13.0782 15.2826H10.7072C9.95753 15.2826 9.35059 14.6747 9.35059 13.926" stroke="currentColor"></path>
<path d="M12 7.71777V16.2824" stroke="currentColor"></path>
    </svg>
  ),
)

DollarSquare.displayName = 'DollarSquare'

export default DollarSquare
