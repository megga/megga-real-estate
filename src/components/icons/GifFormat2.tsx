// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GifFormat2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.06703 4.17578H17.933C20.44 4.17578 22 5.94551 22 8.45038V15.5531C22 18.0569 20.44 19.8266 17.9319 19.8266H6.06703C3.56 19.8266 2 18.0569 2 15.5531V8.45038C2 5.94551 3.56757 4.17578 6.06703 4.17578Z" stroke="currentColor"></path>
<path d="M18.64 9.125H15.5254V14.8764" stroke="currentColor"></path>
<path d="M18.1611 12.4805H15.5254" stroke="currentColor"></path>
<path d="M12.5234 9.125V14.8764" stroke="currentColor"></path>
<path d="M9.42193 9.34501C9.06842 9.16987 8.67491 9.06284 8.25869 9.0423C6.7095 8.96447 5.42734 10.2996 5.36247 11.8488C5.2922 13.5526 6.42302 14.9601 8.10842 14.9601C9.09545 14.9601 9.79923 14.6077 9.79923 13.6207V11.9991H8.10842" stroke="currentColor"></path>
    </svg>
  ),
)

GifFormat2.displayName = 'GifFormat2'

export default GifFormat2
