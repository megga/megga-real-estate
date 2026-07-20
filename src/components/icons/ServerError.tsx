// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerError = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.325V7.78216C21 4.84281 18.9188 3 15.9736 3H8.02638C5.08119 3 3 4.83405 3 7.78216V16.2159C3 19.165 5.08119 21 8.02638 21H13.0547" stroke="currentColor"></path>
<path d="M7.36328 16.1348H10.9613" stroke="currentColor"></path>
<path d="M12.22 12H3.02344" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88577M12.1017 7.86523H16.6358" stroke="currentColor"></path>
<path d="M17.6719 15.0146V17.9482M17.6722 20.8293L17.6829 20.8186" stroke="currentColor"></path>
    </svg>
  ),
)

ServerError.displayName = 'ServerError'

export default ServerError
