// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SwipeUp = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.1378 11.6721C20.0948 14.2554 19.1532 17.6737 17.4762 19.3507C15.3364 21.4905 9.35656 21.6531 7.39883 19.2186C6.15648 17.6737 5.19089 15.7987 4.58223 14.1187C4.25579 13.2177 4.7348 12.246 5.62958 11.9028C6.42164 11.599 7.31871 11.877 7.80014 12.5755L9.00235 14.3197V4.68044C9.00235 3.75236 9.75471 3 10.6828 3C11.6008 3 12.3489 3.73672 12.363 4.65463L12.4298 9.00213C14.7815 9.22671 18.1868 9.10538 19.1378 11.6721Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M17.5542 3.21094V7.23456M17.5542 3.21094L18.9307 4.5875M17.5542 3.21094L16.1777 4.5875" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

SwipeUp.displayName = 'SwipeUp'

export default SwipeUp
