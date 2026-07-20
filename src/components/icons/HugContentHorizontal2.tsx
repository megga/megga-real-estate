// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HugContentHorizontal2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 18.4883C3 19.8755 4.11879 21 5.49889 21L18.5011 21C19.8812 21 21 19.8755 21 18.4884V17.5117C21 16.1245 19.8812 15 18.5011 15L5.49889 15C4.11879 15 3 16.1245 3 17.5116V18.4883Z" stroke="currentColor"></path>
<path d="M5 9L8 6L5 3" stroke="currentColor"></path>
<path d="M19 9L16 6L19 3" stroke="currentColor"></path>
    </svg>
  ),
)

HugContentHorizontal2.displayName = 'HugContentHorizontal2'

export default HugContentHorizontal2
