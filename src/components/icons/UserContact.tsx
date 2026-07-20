// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserContact = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.7195 5.0918H15.7315C18.3371 5.0918 19.9541 6.93262 19.9541 9.53721V16.5629C19.9541 19.1597 18.3371 21.0005 15.7315 21.0005H8.2758C5.67121 21.0005 4.04541 19.1597 4.04541 16.5629V9.53721C4.04541 6.93262 5.679 5.0918 8.2758 5.0918H10.2888" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.3431 6.80424L12.1571 7.39969C12.0618 7.44833 11.9479 7.44833 11.8526 7.40066L10.6588 6.80424C10.4291 6.68943 10.2842 6.45495 10.2842 6.19712V3.95738C10.2842 3.42907 10.7123 3 11.2416 3H12.7584C13.2877 3 13.7168 3.42907 13.7168 3.95738V6.19906C13.7168 6.45495 13.5718 6.68943 13.3431 6.80424Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7487 11.6703C13.7487 12.6364 12.9655 13.4196 11.9994 13.4196C11.0332 13.4196 10.251 12.6364 10.251 11.6703C10.251 10.7041 11.0332 9.92188 11.9994 9.92188C12.9655 9.92188 13.7487 10.7041 13.7487 11.6703Z" stroke="currentColor"></path>
<path d="M9.26172 17.2435C9.26172 16.3494 9.96711 15.2363 11.9996 15.2363C14.0321 15.2363 14.7385 16.3416 14.7385 17.2357" stroke="currentColor"></path>
    </svg>
  ),
)

UserContact.displayName = 'UserContact'

export default UserContact
