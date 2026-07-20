// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserShield2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.4455 19.9996C16.4455 19.9996 18.7001 19.3164 18.7001 17.4346C18.7001 15.5519 18.7822 15.4057 18.6015 15.2241C18.4199 15.0416 16.7413 14.457 16.4455 14.457C16.1498 14.457 14.4703 15.0425 14.2896 15.2241C14.1088 15.4049 14.1901 15.5519 14.1901 17.4346C14.1901 19.3164 16.4455 19.9996 16.4455 19.9996Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4431 7.96081C15.4431 10.1479 13.6694 11.9216 11.4823 11.9216C9.2952 11.9216 7.52148 10.1479 7.52148 7.96081C7.52148 5.77285 9.2952 4 11.4823 4C13.6694 4 15.4431 5.77285 15.4431 7.96081Z" stroke="currentColor"></path>
<path d="M5.28125 19.3618C5.28125 17.3373 6.87854 14.8164 11.4819 14.8164" stroke="currentColor"></path>
    </svg>
  ),
)

UserShield2.displayName = 'UserShield2'

export default UserShield2
