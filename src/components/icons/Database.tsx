// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Database = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.42188 6V11.9997C4.42188 11.9997 4.42188 14.9994 12.0005 14.9994C19.5792 14.9994 19.5792 11.9997 19.5792 11.9997V6" stroke="currentColor"></path>
<path d="M4.42188 12V17.9996C4.42188 17.9996 4.42188 21.0004 12.0005 21.0004C19.5792 21.0004 19.5792 17.9996 19.5792 17.9996V12" stroke="currentColor"></path>
<ellipse cx="12.0005" cy="6.01883" rx="7.57866" ry="3.01883" stroke="currentColor"></ellipse>
    </svg>
  ),
)

Database.displayName = 'Database'

export default Database
