// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Show = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M15.4109 14.3262C15.4109 16.0722 13.9949 17.4872 12.2489 17.4872C10.5029 17.4872 9.08789 16.0722 9.08789 14.3262C9.08789 12.5792 10.5029 11.1642 12.2489 11.1642C13.9949 11.1642 15.4109 12.5792 15.4109 14.3262Z" stroke="currentColor"></path>
<path d="M21.5 14.3254C19.539 10.1973 16.056 7.72083 12.248 7.72083H12.252C8.444 7.72083 4.961 10.1973 3 14.3254" stroke="currentColor"></path>
    </svg>
  ),
)

Show.displayName = 'Show'

export default Show
