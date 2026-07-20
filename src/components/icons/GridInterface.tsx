// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78301 3H16.2175C19.1655 3 20.9995 5.08113 20.9995 8.02625V15.9733C20.9995 18.9184 19.1655 20.9995 16.2165 20.9995H7.78301C4.83498 20.9995 3 18.9184 3 15.9733V8.02625C3 5.08113 4.84374 3 7.78301 3Z" stroke="currentColor"></path>
<path d="M12 3V20.9995" stroke="currentColor"></path>
<path d="M11.9998 14.9177H3M20.9995 10.1309H11.9998" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface.displayName = 'GridInterface'

export default GridInterface
