// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserDelete3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.7808 14.875C8.4054 14.875 5.52637 15.3853 5.52637 17.428C5.52637 19.4707 8.38896 19.9991 11.7808 19.9991" stroke="currentColor"></path>
<path d="M18.4385 15.3537L15.0163 18.7758M18.4739 18.8108L14.9834 15.3203" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.7744 7.99553C15.7744 10.2017 13.9859 11.9911 11.7788 11.9911C9.57265 11.9911 7.78418 10.2017 7.78418 7.99553C7.78418 5.78934 9.57265 4 11.7788 4C13.9859 4 15.7744 5.78934 15.7744 7.99553Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserDelete3.displayName = 'UserDelete3'

export default UserDelete3
