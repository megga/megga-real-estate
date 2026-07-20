// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Unlock3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2761 5.98785C15.7031 4.09285 13.9311 2.72485 11.8531 2.75085C9.38612 2.78085 7.39112 4.76785 7.34912 7.23485V9.40385" stroke="currentColor"></path>
<path d="M11.9099 14.1562V16.3772" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.91 8.82422C6.165 8.82422 4.25 10.3922 4.25 15.0952C4.25 19.7992 6.165 21.3672 11.91 21.3672C17.656 21.3672 19.571 19.7992 19.571 15.0952C19.571 10.3922 17.656 8.82422 11.91 8.82422Z" stroke="currentColor"></path>
    </svg>
  ),
)

Unlock3.displayName = 'Unlock3'

export default Unlock3
