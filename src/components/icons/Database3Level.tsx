// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Database3Level = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M19.6147 6.1709V10.0679C19.6147 11.8192 16.2056 13.2387 12.0002 13.2387C7.7938 13.2387 4.38477 11.8192 4.38477 10.0679V6.1709" stroke="currentColor"></path>
<path d="M19.6147 9.87598V13.7733C19.6147 15.5236 16.2056 16.9441 12.0002 16.9441C7.7938 16.9441 4.38477 15.5236 4.38477 13.7733V9.87598" stroke="currentColor"></path>
<path d="M19.6147 13.9326V17.8289C19.6147 19.5802 16.2056 20.9997 12.0002 20.9997C7.7938 20.9997 4.38477 19.5802 4.38477 17.8289V13.9326" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.6147 6.1708C19.6147 7.92208 16.2056 9.34161 12.0002 9.34161C7.7938 9.34161 4.38477 7.92208 4.38477 6.1708C4.38477 4.41953 7.7938 3 12.0002 3C16.2056 3 19.6147 4.41953 19.6147 6.1708Z" stroke="currentColor"></path>
    </svg>
  ),
)

Database3Level.displayName = 'Database3Level'

export default Database3Level
