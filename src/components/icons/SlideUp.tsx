// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SlideUp = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.8225 11.94C19.7521 14.4495 18.8374 17.77 17.2084 19.3991C15.1297 21.4778 9.32073 21.6357 7.41894 19.2708C6.21208 17.77 5.27408 15.9487 4.68281 14.3166C4.36569 13.4414 4.83103 12.4974 5.70024 12.164C6.46966 11.8689 7.34111 12.139 7.80878 12.8175L8.97664 14.5119V5.14805C8.97664 4.24649 9.7075 3.51562 10.6091 3.51562C11.5009 3.51562 12.2276 4.2313 12.2413 5.12298L12.3062 9.34626C14.5907 9.56442 17.8987 9.44656 18.8225 11.94Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M18.201 8.00482V3M18.201 8.00482L19.4177 6.78809M18.201 8.00482L16.9844 6.78809M18.201 3L19.4177 4.21666M18.201 3L16.9844 4.21666" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

SlideUp.displayName = 'SlideUp'

export default SlideUp
