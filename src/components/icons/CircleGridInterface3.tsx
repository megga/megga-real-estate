// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircleGridInterface3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.5 10C8.433 10 10 8.433 10 6.5C10 4.567 8.433 3 6.5 3C4.567 3 3 4.567 3 6.5C3 8.433 4.567 10 6.5 10Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.5 14C15.567 14 14 15.567 14 17.5C14 19.433 15.567 21 17.5 21C19.433 21 21 19.433 21 17.5C21 15.567 19.433 14 17.5 14Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M5.41 21.0007C4.079 21.0007 3 19.9217 3 18.5897C3 17.2587 4.079 16.1797 5.41 16.1797C6.741 16.1797 7.82 17.2587 7.82 18.5897C7.82 19.9217 6.741 21.0007 5.41 21.0007Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.5897 7.821C17.2587 7.821 16.1797 6.742 16.1797 5.411C16.1797 4.079 17.2587 3 18.5897 3C19.9207 3 20.9997 4.079 20.9997 5.411C20.9997 6.742 19.9207 7.821 18.5897 7.821Z" stroke="currentColor"></path>
    </svg>
  ),
)

CircleGridInterface3.displayName = 'CircleGridInterface3'

export default CircleGridInterface3
