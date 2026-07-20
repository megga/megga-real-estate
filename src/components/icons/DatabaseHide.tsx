// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseHide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.3601 19.6446L15.6611 19.6436" stroke="currentColor"></path>
<path d="M3.64062 6.02832V11.9866C3.64062 11.9866 3.64062 14.9656 11.167 14.9656C18.6934 14.9656 18.6934 11.9866 18.6934 11.9866V6.02832" stroke="currentColor"></path>
<path d="M3.64062 11.9873V17.9455C3.64062 17.9455 3.64062 20.9256 11.167 20.9256" stroke="currentColor"></path>
<ellipse cx="11.167" cy="6.0478" rx="7.52637" ry="2.99799" stroke="currentColor"></ellipse>
    </svg>
  ),
)

DatabaseHide.displayName = 'DatabaseHide'

export default DatabaseHide
