// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User15 = forwardRef<SVGSVGElement, Props>(
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
<path d="M7.88184 17.2574C7.88184 15.9147 8.9453 14.2383 11.9956 14.2383C15.0536 14.2383 16.1171 15.8991 16.1171 17.2418" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.6266 9.37116C14.6266 10.8228 13.4493 12.0001 11.9976 12.0001C10.5459 12.0001 9.36865 10.8228 9.36865 9.37116C9.36865 7.91851 10.5459 6.74219 11.9976 6.74219C13.4493 6.74219 14.6266 7.91851 14.6266 9.37116Z" stroke="currentColor"></path>
    </svg>
  ),
)

User15.displayName = 'User15'

export default User15
