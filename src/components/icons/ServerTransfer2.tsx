// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerTransfer2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9997 11.3519V7.78208C20.9997 4.84278 18.9185 3 15.9734 3H8.02629C5.08115 3 3 4.83402 3 7.78208V16.2157C3 19.1647 5.08115 20.9997 8.02629 20.9997H10.1357" stroke="currentColor"></path>
<path d="M11.2469 12H3.02344" stroke="currentColor"></path>
<path d="M7.36328 16.1357H7.88576" stroke="currentColor"></path>
<path d="M7.36328 7.86523H7.88576M12.1016 7.86523H16.6356" stroke="currentColor"></path>
<path d="M12.7656 15.8964L14.4187 14.3018L16.0708 15.8964" stroke="currentColor"></path>
<path d="M21.0004 19.4053L19.3474 20.9999L17.6953 19.4053" stroke="currentColor"></path>
<path d="M14.418 14.3027V20.5248" stroke="currentColor"></path>
<path d="M19.3477 20.9984V14.7764" stroke="currentColor"></path>
    </svg>
  ),
)

ServerTransfer2.displayName = 'ServerTransfer2'

export default ServerTransfer2
