// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SecurityScan = forwardRef<SVGSVGElement, Props>(
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
      <path d="M2.99902 16.1523V17.7293C2.99902 19.8783 4.742 21.6213 6.892 21.6213H8.14902" stroke="currentColor"></path>
<path d="M20.9994 16.1523V17.7293C20.9994 19.8783 19.2564 21.6213 17.1064 21.6213H15.8174" stroke="currentColor"></path>
<path d="M2.99902 9.09009V7.51309C2.99902 5.36309 4.742 3.62109 6.892 3.62109H8.181" stroke="currentColor"></path>
<path d="M21.0006 9.09009V7.51309C21.0006 5.36309 19.2576 3.62109 17.1076 3.62109H15.8506" stroke="currentColor"></path>
<path d="M17.8729 12.2188H6.12988" stroke="currentColor"></path>
<path d="M16.2869 12.221V10.449C16.2869 9.28104 15.3368 8.33203 14.1808 8.33203H9.82086C8.65286 8.33203 7.71387 9.28104 7.71387 10.449V12.221" stroke="currentColor"></path>
<path d="M16.2869 14.7969C16.2869 15.9639 15.3368 16.9029 14.1808 16.9029H9.82086C8.65286 16.9029 7.71387 15.9639 7.71387 14.7969" stroke="currentColor"></path>
    </svg>
  ),
)

SecurityScan.displayName = 'SecurityScan'

export default SecurityScan
