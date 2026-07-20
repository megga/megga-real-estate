// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User9 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.9389" cy="8.48581" r="4.98581" stroke="currentColor"></circle>
<path d="M14.2716 13.7715H9.72842C7.1517 13.7715 5.06285 15.8603 5.06285 18.4371C5.06285 18.5296 5.06196 18.6226 5.06072 18.7157C5.04687 19.7489 5.88629 20.4992 6.9196 20.4992H17.0804C18.1137 20.4992 18.9531 19.7489 18.9393 18.7157C18.938 18.6225 18.9371 18.5296 18.9371 18.4371C18.9371 15.8603 16.8483 13.7715 14.2716 13.7715Z" stroke="currentColor"></path>
<path d="M15.9263 18.0215V20.4339" stroke="currentColor"></path>
<path d="M8.07373 18.0215V20.4339" stroke="currentColor"></path>
    </svg>
  ),
)

User9.displayName = 'User9'

export default User9
