// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SquareTouchIdCheck = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9569 14.934V8.961C20.9569 6.03 19.131 3.95898 16.197 3.95898H7.80295C4.87695 3.95898 3.04297 6.03 3.04297 8.961V16.871C3.04297 19.802 4.86895 21.873 7.80295 21.873H12.323" stroke="currentColor"></path>
<path d="M8.03711 10.7347C8.82111 9.35774 10.3021 8.42773 12.0011 8.42773C12.6221 8.42773 13.2171 8.55275 13.7571 8.77875" stroke="currentColor"></path>
<path d="M15.7266 10.3613C16.2506 11.1033 16.5586 12.0083 16.5586 12.9863V15.7883" stroke="currentColor"></path>
<path d="M7.44531 16.3708V13.5488" stroke="currentColor"></path>
<path d="M13.756 17.4044V13.1524C13.756 12.1604 12.952 11.3574 11.961 11.3574C10.97 11.3574 10.166 12.1604 10.166 13.1524V13.6324" stroke="currentColor"></path>
<path d="M10.166 17.4021V15.7871" stroke="currentColor"></path>
<path d="M15.2012 20.3628L16.7982 21.9608L20.7922 17.9668" stroke="currentColor"></path>
    </svg>
  ),
)

SquareTouchIdCheck.displayName = 'SquareTouchIdCheck'

export default SquareTouchIdCheck
