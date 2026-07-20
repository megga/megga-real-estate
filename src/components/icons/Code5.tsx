// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Code5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 16.9709 16.9709 21 12 21C7.02908 21 3 16.9709 3 12C3 7.02908 7.02908 3 12 3C16.9709 3 21 7.02908 21 12Z" stroke="currentColor"></path>
<path d="M9.93749 9.35156L7.28809 12.001L9.93749 14.6504" stroke="currentColor"></path>
<path d="M14.0625 9.35156L16.7119 12.001L14.0625 14.6504" stroke="currentColor"></path>
    </svg>
  ),
)

Code5.displayName = 'Code5'

export default Code5
