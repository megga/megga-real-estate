// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Calendar2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M4.00995 10.1336H20.4972" stroke="currentColor"></path>
<path d="M16.358 13.7462H16.3665" stroke="currentColor"></path>
<path d="M12.2537 13.7462H12.2623" stroke="currentColor"></path>
<path d="M8.14043 13.7462H8.14899" stroke="currentColor"></path>
<path d="M16.358 17.3412H16.3665" stroke="currentColor"></path>
<path d="M12.2537 17.3412H12.2623" stroke="currentColor"></path>
<path d="M8.14043 17.3412H8.14899" stroke="currentColor"></path>
<path d="M15.9902 3.28467V6.32865" stroke="currentColor"></path>
<path d="M8.51776 3.28467V6.32865" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.575 4.74536H3.92499V21.7847H20.575V4.74536Z" stroke="currentColor"></path>
    </svg>
  ),
)

Calendar2.displayName = 'Calendar2'

export default Calendar2
