// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCharge = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.93457 9.17399C7.93457 12.1289 10.4701 14.4913 13.4844 14.2033C16.1114 13.9532 18.0408 11.5967 18.0408 8.95702V7.43043C18.0408 6.81065 17.5397 6.30859 16.92 6.30859H9.05543C8.43662 6.30859 7.93457 6.81065 7.93457 7.43043V9.17399Z" stroke="currentColor"></path>
<path d="M17.5272 21C17.5272 20.2596 16.9142 19.6593 16.1592 19.6593H15.1025C13.9359 19.6544 12.9922 18.7291 12.9863 17.5868V14.3906" stroke="currentColor"></path>
<path d="M7.47585 15.5391L5.95898 18.2692H9.59887L8.08201 20.9994" stroke="currentColor"></path>
<path d="M10.4453 3V6.30908M15.5287 3V6.30908" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCharge.displayName = 'PowerOutletCharge'

export default PowerOutletCharge
