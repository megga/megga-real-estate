// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scale2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.9668 20.4388V20.0928C16.9668 18.8498 15.9588 17.8418 14.7148 17.8418H8.84482C7.60082 17.8418 6.5918 18.8498 6.5918 20.0928V20.4388" stroke="currentColor"></path>
<path d="M4.64062 20.4395H18.9186M16.9666 20.4395H6.59161H16.9666Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3 14.2511L5.66699 8.78711L8.36499 14.2511C6.79899 16.4041 4.016 16.2261 3 14.2511Z" stroke="currentColor"></path>
<path d="M8.00015 13.5137H3.36914" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.6348 12.1925L18.3018 6.72852L20.9998 12.1925C19.4338 14.3445 16.6508 14.1675 15.6348 12.1925Z" stroke="currentColor"></path>
<path d="M20.6339 11.4551H16.002" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.1943 5.54684C13.1943 4.76384 12.5613 4.13086 11.7783 4.13086C10.9963 4.13086 10.3633 4.76384 10.3633 5.54684C10.3633 6.32784 10.9963 6.96185 11.7783 6.96185C12.5613 6.96185 13.1943 6.32784 13.1943 5.54684Z" stroke="currentColor"></path>
<path d="M10.3871 5.77795L3.28906 6.96097M20.2711 4.12695L13.1731 5.30997L20.2711 4.12695Z" stroke="currentColor"></path>
<path d="M11.7793 17.8399V6.96289" stroke="currentColor"></path>
    </svg>
  ),
)

Scale2.displayName = 'Scale2'

export default Scale2
