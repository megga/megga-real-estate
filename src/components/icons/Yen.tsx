// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Yen = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.6377 6L11.9979 11.4594L16.3622 6" stroke="currentColor"></path>
<path d="M8.18359 11.4541H15.8195" stroke="currentColor"></path>
<path d="M8.18359 13.9369H15.8195" stroke="currentColor"></path>
<path d="M12.0039 17.9997V11.4541" stroke="currentColor"></path>
    </svg>
  ),
)

Yen.displayName = 'Yen'

export default Yen
