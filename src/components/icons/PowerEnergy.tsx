// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerEnergy = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0069 3.01172V3.04366M5.66278 5.64972L5.68214 5.66908M18.3318 5.66891L18.3773 5.62341M12.0069 20.9892V20.9572M5.66278 18.3512L5.68214 18.3318M3.04937 12.0066H3M21 12.0066H20.9574M18.3318 18.332L18.3773 18.3775" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0006 6C15.3146 6 18 8.68658 18 11.9994C18 15.3134 15.3146 18 12.0006 18C8.68658 18 6 15.3134 6 11.9994C6 8.68658 8.68658 6 12.0006 6Z" stroke="currentColor"></path>
<path d="M11.9882 15L13.9284 12.0009H10.0713L12.0095 9" stroke="currentColor"></path>
    </svg>
  ),
)

PowerEnergy.displayName = 'PowerEnergy'

export default PowerEnergy
