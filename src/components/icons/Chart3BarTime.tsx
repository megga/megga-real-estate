// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarTime = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.33398 11.8916V17.0661M11.5337 8.9375V17.0659M15.6651 14.1545V17.0656" stroke="currentColor"></path>
<path d="M10.7178 3.5H7.28313C4.34378 3.5 2.5 5.58119 2.5 8.52735V16.4736C2.5 19.4198 4.33503 21.5 7.28313 21.5H15.7169C18.6659 21.5 20.5 19.4198 20.5 16.4736V13.5274" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5001 6.00195C21.5001 7.93579 19.932 9.50391 17.9982 9.50391C16.0643 9.50391 14.4971 7.93579 14.4971 6.00195C14.4971 4.06811 16.0643 2.5 17.9982 2.5C19.932 2.5 21.5001 4.06811 21.5001 6.00195Z" stroke="currentColor"></path>
<path d="M19.0864 6.91209L17.979 6.25022V4.82721" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarTime.displayName = 'Chart3BarTime'

export default Chart3BarTime
