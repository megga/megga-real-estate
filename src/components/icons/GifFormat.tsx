// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GifFormat = forwardRef<SVGSVGElement, Props>(
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
<path d="M9.572 9.54467C9.24443 9.38251 8.88118 9.28305 8.49524 9.26467C7.06281 9.19332 5.87686 10.4268 5.8174 11.8603C5.75145 13.4366 6.79794 14.7382 8.35686 14.7382C9.27037 14.7382 9.92119 14.4117 9.92119 13.4993V11.9998H8.35686" stroke="currentColor"></path>
<path d="M12.4434 11.6725V14.7395M12.4434 8.99219V9.003" stroke="currentColor"></path>
<path d="M17.8782 10.0245C17.5712 9.68608 17.1777 9.48175 16.6901 9.41797C15.8771 9.41797 15.2188 10.0774 15.2188 10.8904V14.738" stroke="currentColor"></path>
<path d="M17.435 12.5195H15.2188" stroke="currentColor"></path>
    </svg>
  ),
)

GifFormat.displayName = 'GifFormat'

export default GifFormat
