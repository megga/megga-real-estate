// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences2 = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M13.8789 14.7272C13.875 15.3626 14.3868 15.8822 15.0222 15.886C15.6575 15.8899 16.1771 15.3782 16.181 14.7428C16.1849 14.1074 15.6731 13.5879 15.0377 13.584H15.03C14.3965 13.582 13.8809 14.0938 13.8789 14.7272Z" stroke="currentColor"></path>
<path d="M10.8852 14.7363H7.81641" stroke="currentColor"></path>
<path d="M13.1113 9.26367H16.1801" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.1185 9.27016C10.1224 8.63481 9.61059 8.11524 8.97524 8.11135C8.33989 8.10746 7.82032 8.61924 7.81643 9.25459C7.81254 9.88994 8.32432 10.4095 8.95967 10.4134H8.96745C9.60086 10.4153 10.1165 9.90357 10.1185 9.27016Z" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences2.displayName = 'Preferences2'

export default Preferences2
