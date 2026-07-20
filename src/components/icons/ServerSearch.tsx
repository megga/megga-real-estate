// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9995 11.3518V7.78203C20.9995 4.84276 18.9184 3 15.9733 3H8.02624C5.08113 3 3 4.83401 3 7.78203V16.2155C3 19.1645 5.08113 20.9995 8.02624 20.9995H11.1085" stroke="currentColor"></path>
<path d="M7.36328 16.1348H7.88575" stroke="currentColor"></path>
<path d="M7.36328 7.86426H7.88575M12.1016 7.86426H16.6355" stroke="currentColor"></path>
<path d="M19.5208 19.5234L21.0007 21.0003M17.5203 14.4297C19.1442 14.4297 20.4606 15.7461 20.4606 17.369C20.4606 18.9928 19.1442 20.3092 17.5203 20.3092C15.8965 20.3092 14.5801 18.9928 14.5801 17.369C14.5801 15.7461 15.8965 14.4297 17.5203 14.4297Z" stroke="currentColor"></path>
<path d="M12.2197 12H3.02344" stroke="currentColor"></path>
    </svg>
  ),
)

ServerSearch.displayName = 'ServerSearch'

export default ServerSearch
