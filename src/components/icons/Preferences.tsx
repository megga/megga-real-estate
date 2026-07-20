// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 7.78216L21 16.2169C21 19.165 18.9188 21 15.9736 21L8.02638 21C5.08119 21 3 19.165 3 16.2159L3 7.78216C3 4.83405 5.08119 3 8.02638 3L15.9736 3C18.9188 3 21 4.84281 21 7.78216Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.27277 13.8789C8.63741 13.875 8.11785 14.3868 8.11396 15.0222C8.11006 15.6575 8.62185 16.1771 9.2572 16.181C9.89255 16.1849 10.4121 15.6731 10.416 15.0377L10.416 15.03C10.418 14.3965 9.90617 13.8809 9.27277 13.8789Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.7298 10.1185C15.3652 10.1224 15.8848 9.61059 15.8886 8.97524C15.8925 8.33989 15.3808 7.82032 14.7454 7.81643C14.1101 7.81254 13.5905 8.32432 13.5866 8.95967L13.5866 8.96745C13.5847 9.60086 14.0964 10.1165 14.7298 10.1185Z" stroke="currentColor"></path>
<path d="M9.26367 10.8852L9.26367 7.81641" stroke="currentColor"></path>
<path d="M14.7363 13.1113L14.7363 16.1801" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences.displayName = 'Preferences'

export default Preferences
