// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Location22 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.6505 9.73927C14.6505 8.4133 13.5761 7.33887 12.2511 7.33887C10.9251 7.33887 9.85065 8.4133 9.85065 9.73927C9.85065 11.0643 10.9251 12.1387 12.2511 12.1387C13.5761 12.1387 14.6505 11.0643 14.6505 9.73927Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.2496 22.1387C12.2496 18.5358 5.22723 15.4199 5.05029 9.71248C4.92604 5.70495 8.273 2.13867 12.2496 2.13867C16.2262 2.13867 19.5722 5.70489 19.4498 9.71248C19.2718 15.537 12.2496 18.4394 12.2496 22.1387Z" stroke="currentColor"></path>
    </svg>
  ),
)

Location22.displayName = 'Location22'

export default Location22
