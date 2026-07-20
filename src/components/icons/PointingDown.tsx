// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PointingDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.1378 12.3279C20.0948 9.74458 19.1532 6.32633 17.4762 4.64934C15.3364 2.50953 9.35656 2.34693 7.39883 4.78143C6.15648 6.32633 5.19089 8.2013 4.58223 9.88131C4.25579 10.7823 4.7348 11.754 5.62958 12.0972C6.42164 12.401 7.31871 12.123 7.80014 11.4245L9.00235 9.68031V19.3196C9.00235 20.2476 9.75471 21 10.6828 21C11.6008 21 12.3489 20.2633 12.363 19.3454L12.4298 14.9979C14.7815 14.7733 18.1868 14.8946 19.1378 12.3279Z" stroke="currentColor"></path>
    </svg>
  ),
)

PointingDown.displayName = 'PointingDown'

export default PointingDown
