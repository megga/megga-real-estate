// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Calendar3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.74976 12.7756C2.74976 5.81959 5.06876 3.50159 12.0238 3.50159C18.9798 3.50159 21.2988 5.81959 21.2988 12.7756C21.2988 19.7316 18.9798 22.0496 12.0238 22.0496C5.06876 22.0496 2.74976 19.7316 2.74976 12.7756Z" stroke="currentColor"></path>
<path d="M3.02515 9.32397H21.0331" stroke="currentColor"></path>
<path d="M16.4285 13.261H16.4375" stroke="currentColor"></path>
<path d="M12.0291 13.261H12.0381" stroke="currentColor"></path>
<path d="M7.62135 13.261H7.63035" stroke="currentColor"></path>
<path d="M16.4285 17.1129H16.4375" stroke="currentColor"></path>
<path d="M12.0291 17.1129H12.0381" stroke="currentColor"></path>
<path d="M7.62135 17.1129H7.63035" stroke="currentColor"></path>
<path d="M16.033 2.05005V5.31205" stroke="currentColor"></path>
<path d="M8.02466 2.05005V5.31205" stroke="currentColor"></path>
    </svg>
  ),
)

Calendar3.displayName = 'Calendar3'

export default Calendar3
