// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletRemove = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.96777 9.17388C7.96777 12.1288 10.5033 14.4912 13.5176 14.2032C16.1446 13.9531 18.075 11.5966 18.075 8.95691V7.43032C18.075 6.81053 17.5729 6.30848 16.9532 6.30848H9.08864C8.46983 6.30848 7.96777 6.81053 7.96777 7.43032V9.17388Z" stroke="currentColor"></path>
<path d="M7.69309 19.2381L9.45904 21.0021M7.69309 19.2381L5.92578 17.4727M7.69309 19.2381L9.45904 17.4727M7.69309 19.2381L5.92578 21.0021" stroke="currentColor"></path>
<path d="M17.5623 21C17.5623 20.2596 16.9494 19.6593 16.1943 19.6593H15.1377C13.9711 19.6544 13.0273 18.7291 13.0215 17.5868V14.3906" stroke="currentColor"></path>
<path d="M10.4805 3V6.30908M15.5639 3V6.30908" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletRemove.displayName = 'PowerOutletRemove'

export default PowerOutletRemove
