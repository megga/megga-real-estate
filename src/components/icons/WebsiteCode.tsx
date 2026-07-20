// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WebsiteCode = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78204 3H16.2165C19.1645 3 20.9995 5.08016 20.9995 8.02625V15.9733C20.9995 18.9184 19.1645 20.9995 16.2155 20.9995H7.78204C4.83401 20.9995 3 18.9184 3 15.9733V8.02625C3 5.08016 4.84276 3 7.78204 3Z" stroke="currentColor"></path>
<path d="M6.29906 6.55078H6.28906M8.7853 6.55078H8.7753M11.2711 6.55078H11.2611" stroke="currentColor"></path>
<path d="M20.9995 9.49219H3" stroke="currentColor"></path>
<path d="M10.1811 13.1172L8.18555 15.1127L10.1811 17.1072" stroke="currentColor"></path>
<path d="M13.8184 13.1172L15.8139 15.1127L13.8184 17.1072" stroke="currentColor"></path>
    </svg>
  ),
)

WebsiteCode.displayName = 'WebsiteCode'

export default WebsiteCode
