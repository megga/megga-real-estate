// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.03005 16.9709 3 12 3C7.02908 3 3 7.03005 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M7.3042 19.6557C7.49101 18.203 8.78312 16.5898 11.992 16.5898C15.2349 16.5898 16.5183 18.2118 16.6973 19.682" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.7177 11.3007C14.7177 12.802 13.5005 14.0192 11.9992 14.0192C10.498 14.0192 9.28076 12.802 9.28076 11.3007C9.28076 9.7994 10.498 8.58221 11.9992 8.58221C13.5005 8.58221 14.7177 9.7994 14.7177 11.3007Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserCircle.displayName = 'UserCircle'

export default UserCircle
