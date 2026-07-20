// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Eye3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4 13.7064C7.2 6.77236 16.8 6.77236 20 13.7064" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0034 17.4366C10.7314 17.4366 9.69141 16.4016 9.69141 15.1236C9.69141 13.8466 10.7314 12.8105 12.0034 12.8105C13.2764 12.8105 14.3164 13.8466 14.3164 15.1236C14.3164 16.4016 13.2764 17.4366 12.0034 17.4366Z" stroke="currentColor"></path>
    </svg>
  ),
)

Eye3.displayName = 'Eye3'

export default Eye3
