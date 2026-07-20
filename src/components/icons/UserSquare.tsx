// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9993 13.9725C10.0466 13.9725 8.38086 14.2674 8.38086 15.4495C8.38086 16.6317 10.0378 16.9362 11.9993 16.9362C13.9511 16.9362 15.6178 16.6414 15.6178 15.4593C15.6178 14.2781 13.9618 13.9725 11.9993 13.9725Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.296 9.35872C14.296 10.6275 13.2676 11.6549 11.9998 11.6549C10.7311 11.6549 9.70264 10.6275 9.70264 9.35872C9.70264 8.08996 10.7311 7.0625 11.9998 7.0625C13.2676 7.0625 14.296 8.08996 14.296 9.35872Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserSquare.displayName = 'UserSquare'

export default UserSquare
