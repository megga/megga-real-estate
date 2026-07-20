// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FingerprintScan = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.8346 16.5515C13.3046 16.8895 12.6766 17.0875 12.0006 17.0875C10.1236 17.0875 8.60059 15.5645 8.60059 13.6855V10.8785C8.60059 9.00054 10.1236 7.47852 12.0006 7.47852C13.8796 7.47852 15.4016 9.00054 15.4016 10.8785V13.6855" stroke="currentColor"></path>
<path d="M11.999 13.6288V11.0918" stroke="currentColor"></path>
<path d="M2.99902 15.8145V17.3915C2.99902 19.5405 4.74203 21.2834 6.89203 21.2834H8.14899" stroke="currentColor"></path>
<path d="M20.9994 15.8145V17.3915C20.9994 19.5405 19.2564 21.2834 17.1064 21.2834H15.8174" stroke="currentColor"></path>
<path d="M2.99902 8.75226V7.17523C2.99902 5.02523 4.74203 3.2832 6.89203 3.2832H8.18103" stroke="currentColor"></path>
<path d="M21.0005 8.75226V7.17523C21.0005 5.02523 19.2575 3.2832 17.1075 3.2832H15.8506" stroke="currentColor"></path>
    </svg>
  ),
)

FingerprintScan.displayName = 'FingerprintScan'

export default FingerprintScan
