// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserBoard = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.8268 20.0681H17.3307C20.2097 20.0681 22 18.0367 22 15.162V8.48508C22 5.61041 20.2097 3.58008 17.3318 3.58008H9.51104C7.46126 3.58008 5.95743 4.61686 5.2666 6.26015" stroke="currentColor"></path>
<path d="M17.8072 16.6953H15.4688" stroke="currentColor"></path>
<path d="M2 20.4211C2 19.0395 3.09084 17.3184 6.23255 17.3184C9.37534 17.3184 10.4651 19.0265 10.4651 20.4093" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.93653 12.0563C8.93653 13.5493 7.72568 14.7602 6.23267 14.7602C4.73965 14.7602 3.52881 13.5493 3.52881 12.0563C3.52881 10.5633 4.73965 9.35352 6.23267 9.35352C7.72568 9.35352 8.93653 10.5633 8.93653 12.0563Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserBoard.displayName = 'UserBoard'

export default UserBoard
