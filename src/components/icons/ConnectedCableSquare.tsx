// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectedCableSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M9.87207 9.85241L11.177 8.54748C12.3549 7.36959 14.2646 7.36959 15.4425 8.54748C16.6204 9.72538 16.6204 11.6351 15.4425 12.813L14.1376 14.1179" stroke="currentColor"></path>
<path d="M15.4463 8.5459L19.5625 4.42969" stroke="currentColor"></path>
<path d="M14.1267 14.1444L12.8218 15.4494C11.6439 16.6273 9.73417 16.6273 8.55627 15.4494C7.37838 14.2715 7.37838 12.3617 8.55627 11.1838L9.86121 9.87891" stroke="currentColor"></path>
<path d="M14.6386 14.6376L9.36035 9.35938" stroke="currentColor"></path>
<path d="M8.5542 15.4531L4.38965 19.6177" stroke="currentColor"></path>
<path d="M17.624 13.8478L18.8074 14.1649" stroke="currentColor"></path>
<path d="M5.18164 9.72266L6.36504 10.0397" stroke="currentColor"></path>
<path d="M13.7363 17.625L14.1701 18.7708" stroke="currentColor"></path>
<path d="M9.81934 5.11719L10.2531 6.26298" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectedCableSquare.displayName = 'ConnectedCableSquare'

export default ConnectedCableSquare
