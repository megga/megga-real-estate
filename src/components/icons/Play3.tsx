// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Play3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75 12.0001C2.75 18.9371 5.063 21.2501 12 21.2501C18.937 21.2501 21.25 18.9371 21.25 12.0001C21.25 5.06312 18.937 2.75012 12 2.75012C5.063 2.75012 2.75 5.06312 2.75 12.0001Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.416 11.8555C15.416 10.9515 10.832 8.05953 10.312 8.57953C9.79304 9.09953 9.74204 14.5625 10.312 15.1315C10.883 15.7025 15.416 12.7595 15.416 11.8555Z" stroke="currentColor"></path>
    </svg>
  ),
)

Play3.displayName = 'Play3'

export default Play3
