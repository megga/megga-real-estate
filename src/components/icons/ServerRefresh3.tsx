// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerRefresh3 = forwardRef<SVGSVGElement, Props>(
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
<path d="M12.22 12H3.02344" stroke="currentColor"></path>
<path d="M7.36328 16.1348H7.88577" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88577M12.1017 7.86523H16.6358" stroke="currentColor"></path>
<path d="M19.8393 20.1429C19.2351 20.676 18.4412 21 17.5713 21C15.6789 21 14.1445 19.4657 14.1445 17.5723" stroke="currentColor"></path>
<path d="M15.3047 15.0017C15.9089 14.4685 16.7028 14.1445 17.5717 14.1445C19.4651 14.1445 20.9995 15.6789 20.9995 17.5723" stroke="currentColor"></path>
    </svg>
  ),
)

ServerRefresh3.displayName = 'ServerRefresh3'

export default ServerRefresh3
