// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PyramidChart3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.4344 16.1629L19.5328 16.1629" stroke="currentColor"></path>
<path d="M17.3502 12.3254L6.59766 12.3254" stroke="currentColor"></path>
<path d="M15.3292 8.48804L8.84131 8.48804" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.9584 20.0005C19.663 20.0005 20.0152 20.0005 20.2441 19.9045C20.7534 19.691 21.0585 19.1652 20.9906 18.6176C20.9601 18.3715 20.785 18.0662 20.4346 17.4556L13.4762 5.32809C13.1225 4.71172 12.9457 4.40354 12.7473 4.25254C12.3059 3.91647 11.6941 3.91647 11.2527 4.25254C11.0543 4.40354 10.8775 4.71172 10.5238 5.32809L3.5654 17.4556C3.21505 18.0662 3.03987 18.3715 3.00939 18.6176C2.94155 19.1652 3.24657 19.691 3.75589 19.9045C3.98477 20.0005 4.33703 20.0005 5.04156 20.0005H18.9584Z" stroke="currentColor"></path>
    </svg>
  ),
)

PyramidChart3.displayName = 'PyramidChart3'

export default PyramidChart3
