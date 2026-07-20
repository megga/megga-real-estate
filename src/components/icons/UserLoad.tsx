// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserLoad = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 17.7623L5.56769 18.3558L6.15829 15.8027" stroke="currentColor"></path>
<path d="M21.0001 6.23805L18.4324 5.64453L17.8418 8.19763" stroke="currentColor"></path>
<path d="M5.59598 18.1399C2.25672 14.6849 2.2791 9.17686 5.68063 5.74905C7.81048 3.60266 10.7664 2.77466 13.5345 3.26991" stroke="currentColor"></path>
<path d="M18.4048 5.86133C21.7441 9.31637 21.7217 14.8244 18.3202 18.2522C16.1903 20.3986 13.2344 21.2266 10.4663 20.7313" stroke="currentColor"></path>
<path d="M8.5 16.5607C8.5 15.4039 9.41654 13.959 12.0446 13.959C14.6794 13.959 15.5959 15.3902 15.5959 16.5471" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.3109 9.76509C14.3109 11.0163 13.2971 12.0302 12.0459 12.0302C10.7946 12.0302 9.78076 11.0163 9.78076 9.76509C9.78076 8.51384 10.7946 7.5 12.0459 7.5C13.2971 7.5 14.3109 8.51384 14.3109 9.76509Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserLoad.displayName = 'UserLoad'

export default UserLoad
