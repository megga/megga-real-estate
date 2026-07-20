// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Recieve2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12 3.5C7.30517 3.5 3.5 7.30517 3.5 12C3.5 16.6948 7.30517 20.5 12 20.5C16.6948 20.5 20.5 16.6948 20.5 12" stroke="currentColor"></path>
<path d="M13.2188 6.71587V10.7845M13.2188 10.7845H17.2874M13.2188 10.7845L20.0754 3.92773" stroke="currentColor"></path>
    </svg>
  ),
)

Recieve2.displayName = 'Recieve2'

export default Recieve2
