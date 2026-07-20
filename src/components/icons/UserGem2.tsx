// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserGem2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.1187 14.875C7.74329 14.875 4.86426 15.3853 4.86426 17.428C4.86426 19.4707 7.72686 19.9991 11.1187 19.9991" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.3826 19.9452L19.1354 16.8863L18.2178 15.25H14.5475L13.6299 16.8863L16.3826 19.9452Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.1142 7.99553C15.1142 10.2017 13.3257 11.9911 11.1187 11.9911C8.9125 11.9911 7.12402 10.2017 7.12402 7.99553C7.12402 5.78934 8.9125 4 11.1187 4C13.3257 4 15.1142 5.78934 15.1142 7.99553Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserGem2.displayName = 'UserGem2'

export default UserGem2
