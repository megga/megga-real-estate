// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SwipeRight = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.9815 11.6721C19.9385 14.2554 18.9969 17.6737 17.3199 19.3507C15.1801 21.4905 9.20031 21.6531 7.24258 19.2186C6.00023 17.6737 5.03464 15.7987 4.42598 14.1187C4.09954 13.2177 4.57855 12.246 5.47333 11.9028C6.26539 11.599 7.16246 11.877 7.64389 12.5755L8.8461 14.3197V4.68044C8.8461 3.75236 9.59846 3 10.5265 3C11.4446 3 12.1927 3.73672 12.2068 4.65463L12.2736 9.00213C14.6253 9.22671 18.0306 9.10538 18.9815 11.6721Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M18.1953 3.53125L19.6778 5.01361L18.1953 6.49596" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M19.6768 5.01172H14.9121" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

SwipeRight.displayName = 'SwipeRight'

export default SwipeRight
