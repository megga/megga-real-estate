// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SlideLeft = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.1876 11.6721C19.1446 14.2554 18.203 17.6737 16.526 19.3507C14.3862 21.4905 8.40636 21.6531 6.44864 19.2186C5.20629 17.6737 4.24069 15.7987 3.63203 14.1187C3.30559 13.2177 3.78461 12.246 4.67938 11.9028C5.47144 11.599 6.36852 11.877 6.84995 12.5755L8.05216 14.3197V4.68044C8.05216 3.75236 8.80451 3 9.73259 3C10.6506 3 11.3987 3.73672 11.4128 4.65463L11.4796 9.00213C13.8313 9.22671 17.2366 9.10538 18.1876 11.6721Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M15.8774 4.05859L14.625 5.31104L15.8774 6.56348" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M19.2188 4.05859L20.4713 5.31104L19.2188 6.56348" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M20.4697 5.3125H14.625" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

SlideLeft.displayName = 'SlideLeft'

export default SlideLeft
