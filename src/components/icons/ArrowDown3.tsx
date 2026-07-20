// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDown3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.2742 19.7501V4.75012" stroke="currentColor"></path>
<path d="M18.2988 13.6998C18.2988 13.6998 15.0378 19.7498 12.2758 19.7498C9.51176 19.7498 6.24976 13.6998 6.24976 13.6998" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDown3.displayName = 'ArrowDown3'

export default ArrowDown3
