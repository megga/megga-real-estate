// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserAnalyze = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="10.9829" cy="8.18704" r="4.70071" stroke="currentColor"></circle>
<path d="M4.5676 19.5129C4.45675 18.8747 4.50253 18.2133 4.50253 17.5687C4.50253 15.1393 6.47194 13.1699 8.90132 13.1699H13.1847C14.3669 13.1699 15.4403 13.6364 16.2307 14.3952" stroke="currentColor"></path>
<path d="M19.5065 17.6816L17.1294 20.0589L15.2669 18.1964L12.9502 20.513" stroke="currentColor"></path>
    </svg>
  ),
)

UserAnalyze.displayName = 'UserAnalyze'

export default UserAnalyze
