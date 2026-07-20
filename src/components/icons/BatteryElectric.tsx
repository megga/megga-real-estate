// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BatteryElectric = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 17.8416L5.68231 18.3747L6.21255 15.707" stroke="currentColor"></path>
<path d="M5.66561 18.0493C2.36258 14.6315 2.38496 9.18319 5.74928 5.7926C7.85563 3.66971 10.7802 2.85052 13.518 3.34087" stroke="currentColor"></path>
<path d="M20.9997 6.15815L18.3173 5.625L17.7871 8.29272" stroke="currentColor"></path>
<path d="M18.3348 5.94922C21.6378 9.36705 21.6154 14.8153 18.2511 18.2059C16.1448 20.3288 13.2202 21.148 10.4824 20.6577" stroke="currentColor"></path>
<path d="M8.36907 12.2237L10.3872 7.29931C10.4325 7.17583 10.5501 7.09375 10.6816 7.09375H13.3871C13.6035 7.09375 13.7548 7.30776 13.6827 7.51178L12.4862 10.3198C12.4141 10.5239 12.5655 10.7379 12.7819 10.7379H15.3365C15.606 10.7379 15.7499 11.0553 15.5724 11.258L10.7218 16.7946C10.5032 17.044 10.0975 16.8276 10.183 16.5072L11.1076 13.0395C11.1607 12.8405 11.0107 12.6452 10.8047 12.6452H8.66343C8.44546 12.6452 8.294 12.4283 8.36907 12.2237Z" stroke="currentColor"></path>
    </svg>
  ),
)

BatteryElectric.displayName = 'BatteryElectric'

export default BatteryElectric
