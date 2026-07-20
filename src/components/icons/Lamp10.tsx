// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lamp10 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.04688 9.80723C5.04688 12.62 6.78748 15.029 9.27043 16.0545V18.3195C9.27043 19.7935 10.5012 21 12.0064 21C13.5105 21 14.7413 19.7935 14.7413 18.3195V16.0662C17.6358 14.8675 19.5185 11.7434 18.8004 8.35462C18.2478 5.76074 16.1064 3.67475 13.459 3.14449C8.98828 2.25716 5.04688 5.57686 5.04688 9.80723Z" stroke="currentColor"></path>
<path d="M13.8728 9.33594L11.9989 11.2098L10.125 9.33594" stroke="currentColor"></path>
<path d="M12 11.2031V16.0766" stroke="currentColor"></path>
<path d="M9.33203 16.0703H14.6706" stroke="currentColor"></path>
    </svg>
  ),
)

Lamp10.displayName = 'Lamp10'

export default Lamp10
