// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserInformation = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 8.59443C21 6.0647 19.4306 4.2793 16.9018 4.2793H7.10595C4.58595 4.2793 3 6.0647 3 8.59443V15.413C3 17.934 4.57719 19.7194 7.10595 19.7194H16.8931C19.4306 19.7194 21 17.934 21 15.413V8.59443Z" stroke="currentColor"></path>
<path d="M6.2085 16.0193C6.2085 15.0473 6.9752 13.8379 9.18482 13.8379C11.3944 13.8379 12.1611 15.0385 12.1611 16.0105" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.0866 9.88166C11.0866 10.9315 10.2352 11.7828 9.18537 11.7828C8.13553 11.7828 7.28418 10.9315 7.28418 9.88166C7.28418 8.83182 8.13553 7.98047 9.18537 7.98047C10.2352 7.98047 11.0866 8.83182 11.0866 9.88166Z" stroke="currentColor"></path>
<path d="M14.1206 10.3477L17.5931 10.3953M15.4223 14.0496H17.593" stroke="currentColor"></path>
    </svg>
  ),
)

UserInformation.displayName = 'UserInformation'

export default UserInformation
