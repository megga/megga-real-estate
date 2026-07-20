// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Swap2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.9045 20.1495L16.9045 6.21026" stroke="currentColor"></path>
<path d="M12.309 15.5548C14.6715 15.5548 16.9045 17.6354 16.9045 20.1503" stroke="currentColor"></path>
<path d="M21.5001 15.5548C19.1376 15.5548 16.9045 17.6354 16.9045 20.1503" stroke="currentColor"></path>
<path d="M7.59546 3.84973L7.59546 17.789" stroke="currentColor"></path>
<path d="M2.99995 8.44543C5.36243 8.44543 7.59546 6.36483 7.59546 3.84992" stroke="currentColor"></path>
<path d="M12.191 8.44543C9.82849 8.44543 7.59546 6.36483 7.59546 3.84992" stroke="currentColor"></path>
    </svg>
  ),
)

Swap2.displayName = 'Swap2'

export default Swap2
