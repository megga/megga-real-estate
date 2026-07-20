// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUp3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.7258 4.24988L11.7258 19.2499" stroke="currentColor"></path>
<path d="M5.70124 10.3002C5.70124 10.3002 8.96224 4.25017 11.7242 4.25017C14.4882 4.25017 17.7502 10.3002 17.7502 10.3002" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowUp3.displayName = 'ArrowUp3'

export default ArrowUp3
