// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Restart = forwardRef<SVGSVGElement, Props>(
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
<path d="M8.66602 8.88917C8.79445 8.75004 8.93164 8.61869 9.07758 8.49609" stroke="currentColor"></path>
<path d="M7.5257 11.1094C7.45273 11.4898 7.42646 11.8858 7.45662 12.2915" stroke="currentColor"></path>
<path d="M9.39291 15.7297C8.9035 15.3911 8.48318 14.9571 8.1582 14.4531" stroke="currentColor"></path>
<path d="M14.8156 15.5859C14.1287 16.124 13.2812 16.4723 12.3462 16.5424C12.1204 16.5589 11.8986 16.5589 11.6807 16.5433" stroke="currentColor"></path>
<path d="M16.3427 13.3722C16.4974 12.8877 16.5723 12.3691 16.5519 11.832C16.4555 9.31397 14.3364 7.35148 11.8184 7.44878" stroke="currentColor"></path>
    </svg>
  ),
)

Restart.displayName = 'Restart'

export default Restart
