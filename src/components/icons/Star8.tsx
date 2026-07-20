// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Star8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.25 2.75L14.0166 8.94017L20.2607 7.375L15.7832 12L20.2607 16.625L14.0166 15.0598L12.25 21.25L10.4834 15.0598L4.23927 16.625L8.71681 12L4.23927 7.375L10.4834 8.94017L12.25 2.75Z" stroke="currentColor"></path>
    </svg>
  ),
)

Star8.displayName = 'Star8'

export default Star8
