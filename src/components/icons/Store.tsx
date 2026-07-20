// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.7863 3.83979H18.2141C18.9983 3.83979 19.7008 4.33309 19.98 5.07936L20.8742 7.68108C21.346 8.94302 20.4324 10.2945 19.1082 10.2945H4.89214C3.56793 10.2945 2.65334 8.94302 3.1262 7.68108L4.01939 5.07936C4.29961 4.33309 5.00209 3.83979 5.7863 3.83979Z" stroke="currentColor"></path>
<path d="M8.53418 10.2955L9.44001 3.84082" stroke="currentColor"></path>
<path d="M15.5621 10.2955L14.6562 3.84082" stroke="currentColor"></path>
<path d="M4.79004 10.302V17.5496C4.79685 18.9984 5.97706 20.1669 7.42582 20.1601H16.5727C18.0215 20.1679 19.2026 19.0003 19.2104 17.5516V10.2952" stroke="currentColor"></path>
<path d="M9.53711 20.1595V16.6782C9.53711 15.318 10.6395 14.2156 11.9997 14.2156C13.3599 14.2156 14.4633 15.318 14.4633 16.6782V20.1595" stroke="currentColor"></path>
    </svg>
  ),
)

Store.displayName = 'Store'

export default Store
