// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Download22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.875 9.19275H21.5V20.6216H3V9.19275H7.625" stroke="currentColor"></path>
<path d="M12.25 17.5951L12.25 3.65582" stroke="currentColor"></path>
<path d="M7.65449 12.9994C10.017 12.9994 12.25 15.08 12.25 17.5949" stroke="currentColor"></path>
<path d="M16.8455 12.9994C14.483 12.9994 12.25 15.08 12.25 17.5949" stroke="currentColor"></path>
    </svg>
  ),
)

Download22.displayName = 'Download22'

export default Download22
