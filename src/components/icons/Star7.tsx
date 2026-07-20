// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Star7 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.25 2.75L14.3268 9.14159H21.0473L15.6103 13.0918L17.687 19.4834L12.25 15.5332L6.81299 19.4834L8.88974 13.0918L3.45273 9.14159H10.1732L12.25 2.75Z" stroke="currentColor"></path>
    </svg>
  ),
)

Star7.displayName = 'Star7'

export default Star7
