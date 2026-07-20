// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseServer = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.4248 5.60352V9.07356C5.4248 9.07356 5.4248 11.6759 12.0002 11.6759C18.5756 11.6759 18.5756 9.07356 18.5756 9.07356V5.60352" stroke="currentColor"></path>
<path d="M5.42383 9.07324V12.5429C5.42383 12.5429 5.42383 15.1466 11.9992 15.1466C18.5746 15.1466 18.5746 12.5429 18.5746 12.5429V9.07324" stroke="currentColor"></path>
<ellipse cx="11.9992" cy="5.59745" rx="6.5754" ry="2.59745" stroke="currentColor"></ellipse>
<path fillRule="evenodd" clipRule="evenodd" d="M13.5945 19.4032C13.5945 20.2847 12.8794 20.9998 11.998 20.9998C11.1165 20.9998 10.4014 20.2847 10.4014 19.4032C10.4014 18.5217 11.1165 17.8066 11.998 17.8066C12.8794 17.8066 13.5945 18.5217 13.5945 19.4032Z" stroke="currentColor"></path>
<path d="M18.2011 19.4033H13.5728M10.4183 19.4033H5.7998" stroke="currentColor"></path>
<path d="M11.999 17.8016V15.1583" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseServer.displayName = 'DatabaseServer'

export default DatabaseServer
