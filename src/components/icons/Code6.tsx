// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Code6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.667 4.66797C16.667 4.66797 20.0002 6.66809 20.0002 12.0014C20.0002 17.3357 16.667 19.3359 16.667 19.3359" stroke="currentColor"></path>
<path d="M7.3332 4.66406C7.3332 4.66406 4 6.66419 4 11.9975C4 17.3318 7.3332 19.332 7.3332 19.332" stroke="currentColor"></path>
    </svg>
  ),
)

Code6.displayName = 'Code6'

export default Code6
