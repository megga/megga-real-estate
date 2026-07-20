// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User10 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M6.83887 20.9222V20.0173C6.83887 18.334 8.17184 16.2324 11.9956 16.2324C15.8291 16.2324 17.1621 18.3146 17.1621 19.9978V20.9222" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.295 10.5259C15.295 12.3464 13.82 13.8214 11.9996 13.8214C10.1791 13.8214 8.70312 12.3464 8.70312 10.5259C8.70312 8.7055 10.1791 7.23047 11.9996 7.23047C13.82 7.23047 15.295 8.7055 15.295 10.5259Z" stroke="currentColor"></path>
    </svg>
  ),
)

User10.displayName = 'User10'

export default User10
