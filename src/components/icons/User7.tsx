// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User7 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M15.9951 7.99553C15.9951 10.2017 14.2066 11.9911 11.9995 11.9911C9.79336 11.9911 8.00488 10.2017 8.00488 7.99553C8.00488 5.78934 9.79336 4 11.9995 4C14.2066 4 15.9951 5.78934 15.9951 7.99553Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9996 14.875C8.62415 14.875 5.74512 15.3853 5.74512 17.428C5.74512 19.4707 8.60771 19.9991 11.9996 19.9991C15.3733 19.9991 18.2541 19.4872 18.2541 17.4461C18.2541 15.4034 15.3923 14.875 11.9996 14.875Z" stroke="currentColor"></path>
    </svg>
  ),
)

User7.displayName = 'User7'

export default User7
