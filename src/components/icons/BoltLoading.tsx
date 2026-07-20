// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BoltLoading = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.7793 6.63383C5.2003 6.06083 5.68731 5.54123 6.23131 5.08203" stroke="currentColor"></path>
<path d="M17.5621 19.0859C16.2061 20.1484 14.5311 20.8362 12.6841 20.9734C11.7741 21.0415 10.8861 20.9695 10.0391 20.7798" stroke="currentColor"></path>
<path d="M6.84946 19.3599C5.49346 18.422 4.40847 17.1163 3.73047 15.5781" stroke="currentColor"></path>
<path d="M3.3251 9.54297C3.0621 10.5062 2.94809 11.5248 3.02609 12.5765" stroke="currentColor"></path>
<path d="M19.6456 16.7239C20.5556 15.2557 21.0616 13.5192 20.9906 11.6638C20.7996 6.69115 16.6146 2.81605 11.6426 3.00675" stroke="currentColor"></path>
<path d="M11.9836 16L14.5706 12.0011H9.42773L12.012 8" stroke="currentColor"></path>
    </svg>
  ),
)

BoltLoading.displayName = 'BoltLoading'

export default BoltLoading
