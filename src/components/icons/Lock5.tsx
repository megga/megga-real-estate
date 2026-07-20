// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lock5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.4497 10.3591V8.26289C16.4197 5.80569 14.4027 3.83919 11.9457 3.86949C9.53974 3.89969 7.59373 5.83789 7.55273 8.24339V10.3591" stroke="currentColor"></path>
<path d="M9.41211 17.854H14.5891M9.41211 14.5371H14.5891H9.41211Z" stroke="currentColor"></path>
<path d="M9.30371 21.9093H14.6957C16.2907 21.9093 17.0887 21.9093 17.7047 21.6136C18.3187 21.3185 18.8147 20.8226 19.1097 20.2079C19.4057 19.5922 19.4058 18.7946 19.4058 17.1993V15.0674C19.4058 13.4721 19.4057 12.6744 19.1097 12.0588C18.8147 11.444 18.3187 10.9482 17.7047 10.653C17.0887 10.3574 16.2907 10.3574 14.6957 10.3574H9.30371C7.70871 10.3574 6.91074 10.3574 6.29474 10.653C5.68074 10.9482 5.18477 11.444 4.88977 12.0588C4.59377 12.6744 4.59375 13.4721 4.59375 15.0674V17.1993C4.59375 18.7946 4.59377 19.5922 4.88977 20.2079C5.18477 20.8226 5.68074 21.3185 6.29474 21.6136C6.91074 21.9093 7.70871 21.9093 9.30371 21.9093Z" stroke="currentColor"></path>
    </svg>
  ),
)

Lock5.displayName = 'Lock5'

export default Lock5
