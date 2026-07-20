// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScreemZoomOut = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 16.2178V7.78313C3 4.83503 5.08119 3 8.02638 3H15.9736C18.9188 3 21 4.83503 21 7.78313V16.2178C21 19.1659 18.9188 21 15.9736 21H8.02638C5.08119 21 3 19.1562 3 16.2178Z" stroke="currentColor"></path>
<path d="M7.42578 14.1738L8.43184 14.1719C9.2034 14.1699 9.82902 14.7956 9.82805 15.5671L9.82611 16.5732" stroke="currentColor"></path>
<path d="M9.82415 7.42578L9.8261 8.43184C9.82804 9.2034 9.20242 9.83 8.43085 9.82805L7.42383 9.82611" stroke="currentColor"></path>
<path d="M14.1738 16.5741L14.1719 15.5681C14.1699 14.7965 14.7956 14.1709 15.5671 14.1719L16.5742 14.1748" stroke="currentColor"></path>
<path d="M16.5741 9.82611L15.5681 9.82805C14.7965 9.83 14.1709 9.20438 14.1719 8.43184L14.1738 7.42578" stroke="currentColor"></path>
    </svg>
  ),
)

ScreemZoomOut.displayName = 'ScreemZoomOut'

export default ScreemZoomOut
