// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Recieve = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.1206 3.5H8.01633C5.24061 3.5 3.5 5.46539 3.5 8.24678V15.7532C3.5 18.5346 5.23211 20.5 8.01633 20.5H15.9818C18.7669 20.5 20.5 18.5346 20.5 15.7532V14.1089" stroke="currentColor"></path>
<path d="M12.791 6.6333V11.2072M12.791 11.2072H17.365M12.791 11.2072L19.9631 4.03516" stroke="currentColor"></path>
    </svg>
  ),
)

Recieve.displayName = 'Recieve'

export default Recieve
