// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PointingLeft = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.6721 19.1387C14.2554 20.0958 17.6737 19.1541 19.3507 17.4771C21.4905 15.3373 21.6531 9.35753 19.2186 7.39981C17.6737 6.15746 15.7987 5.19186 14.1187 4.5832C13.2177 4.25676 12.246 4.73578 11.9028 5.63056C11.599 6.42261 11.877 7.31969 12.5755 7.80112L14.3197 9.00333L4.68044 9.00333C3.75236 9.00333 3 9.75569 3 10.6838C3 11.6018 3.73672 12.3499 4.65463 12.364L9.00213 12.4308C9.22671 14.7825 9.10538 18.1878 11.6721 19.1387Z" stroke="currentColor"></path>
    </svg>
  ),
)

PointingLeft.displayName = 'PointingLeft'

export default PointingLeft
