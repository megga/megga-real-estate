// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SwipeRight2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.8582 14.0227C19.8738 16.7479 17.842 19.6068 15.7157 20.5983C13.0026 21.8634 7.38895 19.9914 6.39278 17.066C5.76063 15.2095 5.49741 13.1399 5.50002 11.3723C5.50142 10.4243 6.27546 9.68308 7.22334 9.66678C8.0624 9.65236 8.80224 10.2143 9.01344 11.0265L9.54084 13.0546L12.8022 4.09424C13.1162 3.23152 14.0701 2.7867 14.9328 3.1007C15.7862 3.4113 16.2323 4.34926 15.9349 5.20729L14.526 9.2712C16.6362 10.2756 19.8427 11.315 19.8582 14.0227Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M7.98828 3.28516L9.84615 4.33309L8.79821 6.19096" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M9.84726 4.34766C7.39434 4.7744 5.27769 5.63053 4.14258 7.54368" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

SwipeRight2.displayName = 'SwipeRight2'

export default SwipeRight2
