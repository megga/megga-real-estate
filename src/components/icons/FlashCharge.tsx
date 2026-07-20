// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashCharge = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.9996 7.56582C17.8946 3.85782 13.4056 2.05382 9.22555 3.49682C4.53555 5.11982 2.04055 10.2418 3.66355 14.9318C5.27755 19.6318 10.3986 22.1278 15.0986 20.5038C18.0056 19.5018 20.0696 17.1668 20.8316 14.4108" stroke="currentColor"></path>
<path d="M20.2419 4.26953V7.56853H16.9609" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.6533 7.7062L8.30582 12.3171C8.06695 12.6459 8.30193 13.1066 8.70814 13.1066H11.4465V16.0017C11.4465 16.4833 12.0639 16.6842 12.347 16.2936L15.6945 11.6832C15.9333 11.3543 15.6984 10.8931 15.2922 10.8931H12.5533V7.99858C12.5533 7.51647 11.9364 7.31604 11.6533 7.7062Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashCharge.displayName = 'FlashCharge'

export default FlashCharge
