// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerRefresh = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 11.352V7.78216C21 4.84281 18.9188 3 15.9736 3H8.02638C5.08119 3 3 4.83405 3 7.78216V16.2159C3 19.165 5.08119 21 8.02638 21H11.1088" stroke="currentColor"></path>
<path d="M7.36328 16.1348H7.88577" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88577M12.1008 7.86523H16.6348" stroke="currentColor"></path>
<path d="M12.22 12H3.02344" stroke="currentColor"></path>
<path d="M17.0456 19.3082L15.3809 20.1537C15.9773 20.6801 16.7605 20.9992 17.6177 20.9992C19.4858 20.9992 20.9998 19.4853 20.9998 17.6172" stroke="currentColor"></path>
<path d="M18.1905 15.9264L19.8552 15.0809C19.2588 14.5545 18.4756 14.2354 17.6184 14.2354C15.7503 14.2354 14.2363 15.7493 14.2363 17.6174" stroke="currentColor"></path>
    </svg>
  ),
)

ServerRefresh.displayName = 'ServerRefresh'

export default ServerRefresh
