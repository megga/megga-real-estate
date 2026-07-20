// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerCharge = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M8.60547 13.2953C8.60547 15.2798 10.3083 16.8663 12.3326 16.6729C14.0968 16.505 15.3932 14.9224 15.3932 13.1496V12.1244C15.3932 11.7082 15.0561 11.371 14.6398 11.371H9.35821C8.94263 11.371 8.60547 11.7082 8.60547 12.1244V13.2953Z" stroke="currentColor"></path>
<path d="M12 20.9976V16.7969" stroke="currentColor"></path>
<path d="M10.293 9.14844V11.3707M13.7068 9.14844V11.3707" stroke="currentColor"></path>
    </svg>
  ),
)

PowerCharge.displayName = 'PowerCharge'

export default PowerCharge
