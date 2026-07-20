// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PoliceBadge = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.3843 11.2112L13.0214 12.4843C13.0845 12.6098 13.2054 12.6962 13.3445 12.7158L14.7699 12.921C15.001 12.9514 15.1634 13.1636 15.1331 13.3947C15.1205 13.4891 15.0763 13.577 15.0076 13.6432L13.9767 14.6337C13.8753 14.7302 13.8289 14.8707 13.8533 15.0087L14.0973 16.407C14.1349 16.6405 13.976 16.8601 13.7425 16.8977C13.6505 16.9123 13.5564 16.8967 13.4741 16.8531L12.2006 16.193C12.0751 16.1282 11.9263 16.1282 11.8008 16.193L10.5266 16.8534C10.3179 16.9642 10.0589 16.8848 9.94809 16.676C9.90453 16.5934 9.88884 16.4993 9.90383 16.4073L10.1478 15.0087C10.1718 14.871 10.1255 14.7306 10.0244 14.634L8.99244 13.6435C8.8248 13.4818 8.81957 13.2149 8.98129 13.0469C9.04751 12.9782 9.13533 12.9339 9.23013 12.9214L10.6556 12.7161C10.7947 12.6966 10.9156 12.6102 10.979 12.4847L11.6172 11.2112C11.727 10.9993 11.9877 10.9167 12.1996 11.0265C12.2787 11.0672 12.3431 11.1317 12.3843 11.2112Z" stroke="currentColor"></path>
<path d="M18.909 11.9745C17.1826 8.08177 18.3627 6.49789 19.4856 5.91397L18.3009 4.48704C16.9386 5.11903 13.5578 5.1815 12.0002 3.03308C10.4426 5.1815 7.06174 5.11903 5.69942 4.48704L4.51479 5.91397C5.6377 6.49789 6.81779 8.08177 5.09137 11.9745C1.95393 19.0489 12.0002 21.5331 12.0002 21.5331C12.0002 21.5331 22.0464 19.0489 18.909 11.9745Z" stroke="currentColor"></path>
<path d="M9.45508 8.11553C11.4824 7.50537 12.5961 7.51758 14.5449 8.11553" stroke="currentColor"></path>
    </svg>
  ),
)

PoliceBadge.displayName = 'PoliceBadge'

export default PoliceBadge
