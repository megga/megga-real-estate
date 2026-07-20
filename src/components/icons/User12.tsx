// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User12 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9699 7.02908 21 12 21C16.9709 21 21 16.9699 21 12Z" stroke="currentColor"></path>
<path d="M6.85205 19.3743C7.05638 17.7884 8.46719 16.0273 11.9699 16.0273C15.5115 16.0273 16.9126 17.7981 17.1072 19.4035" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.2682 10.3267C15.2682 12.1471 13.7931 13.6222 11.9727 13.6222C10.1523 13.6222 8.67627 12.1471 8.67627 10.3267C8.67627 8.50628 10.1523 7.03125 11.9727 7.03125C13.7931 7.03125 15.2682 8.50628 15.2682 10.3267Z" stroke="currentColor"></path>
    </svg>
  ),
)

User12.displayName = 'User12'

export default User12
