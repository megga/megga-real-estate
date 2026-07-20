// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseRemove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.1954 19.2809L16.574 20.9037M18.1954 19.2809L19.8168 17.658M18.1954 19.2809L19.8169 20.9023M18.1954 19.2809L16.5732 17.6572" stroke="currentColor"></path>
<path d="M4.14941 5.95312V11.8601C4.14941 11.8601 4.14941 14.8135 11.611 14.8135C19.0726 14.8135 19.0726 11.8601 19.0726 11.8601V5.95312" stroke="currentColor"></path>
<path d="M4.14941 11.8604V17.7673C4.14941 17.7673 4.14941 20.7217 11.611 20.7217" stroke="currentColor"></path>
<ellipse cx="11.611" cy="5.97218" rx="7.46157" ry="2.97218" stroke="currentColor"></ellipse>
    </svg>
  ),
)

DatabaseRemove.displayName = 'DatabaseRemove'

export default DatabaseRemove
