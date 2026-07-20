// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScanKey = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 9.09023V7.51304C3 5.36375 4.74259 3.62115 6.89286 3.62115H8.18205" stroke="currentColor"></path>
<path d="M3 16.1523V17.7295C3 19.8788 4.74259 21.6214 6.89286 21.6214H8.14994" stroke="currentColor"></path>
<path d="M21.0004 16.1523V17.7295C21.0004 19.8788 19.2578 21.6214 17.1075 21.6214H15.8184" stroke="currentColor"></path>
<path d="M20.9995 9.09017V7.51298C20.9995 5.36369 19.257 3.62109 17.1067 3.62109H15.8496" stroke="currentColor"></path>
<path d="M9.95654 10.624L9.96655 10.634" stroke="currentColor"></path>
<path d="M16.9395 14.9851L13.7875 11.8326C13.8404 11.5919 13.8765 11.3494 13.8765 11.0929C13.8765 9.17656 12.323 7.62305 10.4067 7.62305C8.49031 7.62305 6.9368 9.17656 6.9368 11.0929C6.9368 13.0093 8.49031 14.5628 10.4067 14.5628C10.7787 14.5628 11.1385 14.5042 11.4745 14.3958L12.1889 15.1086H13.0186V16.3738H14.3046V17.1968C14.3046 17.4297 14.4934 17.6184 14.7262 17.6184H16.6414C16.8742 17.6184 17.063 17.4297 17.063 17.1968V15.2832C17.063 15.1714 17.0186 15.0642 16.9395 14.9851Z" stroke="currentColor"></path>
    </svg>
  ),
)

ScanKey.displayName = 'ScanKey'

export default ScanKey
