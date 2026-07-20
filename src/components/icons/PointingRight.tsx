// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PointingRight = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.3279 19.1387C9.74458 20.0958 6.32633 19.1541 4.64934 17.4771C2.50953 15.3373 2.34693 9.35753 4.78143 7.39981C6.32633 6.15746 8.2013 5.19186 9.88131 4.5832C10.7823 4.25676 11.754 4.73578 12.0972 5.63056C12.401 6.42261 12.123 7.31969 11.4245 7.80112L9.68031 9.00333L19.3196 9.00333C20.2476 9.00333 21 9.75569 21 10.6838C21 11.6018 20.2633 12.3499 19.3454 12.364L14.9979 12.4308C14.7733 14.7825 14.8946 18.1878 12.3279 19.1387Z" stroke="currentColor"></path>
    </svg>
  ),
)

PointingRight.displayName = 'PointingRight'

export default PointingRight
