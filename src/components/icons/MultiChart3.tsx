// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MultiChart3 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M5.73658 5.84009C5.73658 4.97991 6.43389 4.2826 7.29407 4.2826C8.15425 4.2826 8.85156 4.97991 8.85156 5.84009C8.85156 6.70027 8.15425 7.39758 7.29407 7.39758C6.43389 7.39758 5.73658 6.70027 5.73658 5.84009Z" stroke="currentColor"></path>
<path d="M11.5049 16.586C11.5049 14.3683 9.70713 12.5701 7.48905 12.5701C5.27097 12.5701 3.47314 14.3683 3.47314 16.586C3.47314 18.8041 5.27097 20.6019 7.48905 20.6019C9.70713 20.6019 11.5049 18.8041 11.5049 16.586Z" stroke="currentColor"></path>
<path d="M7.35059 12.5716V16.2772C7.35059 16.5236 7.55036 16.7234 7.7968 16.7234H11.5024" stroke="currentColor"></path>
<path d="M12.9814 3.11755V10.2744C12.9814 10.7504 13.3673 11.1362 13.8432 11.1362H21.0001" stroke="currentColor"></path>
<path d="M15.2207 7.90133L17.2487 5.39617L18.7833 7.2919L20.8332 4.81381" stroke="currentColor"></path>
<path d="M14.7349 20.8835V18.9629" stroke="currentColor"></path>
<path d="M17.8677 20.8835L17.8677 14.6476" stroke="currentColor"></path>
<path d="M21 20.8835L21 17.2168" stroke="currentColor"></path>
<path d="M3 7.58467V7.59362" stroke="currentColor"></path>
<path d="M5.42236 9.62703V9.63598" stroke="currentColor"></path>
    </svg>
  ),
)

MultiChart3.displayName = 'MultiChart3'

export default MultiChart3
