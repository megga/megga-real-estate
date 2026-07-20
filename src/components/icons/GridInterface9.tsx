// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GridInterface9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78909 3H16.2103C19.1536 3 20.9857 5.07733 20.9857 8.01866V15.9534C20.9857 18.8937 19.1536 20.972 16.2093 20.972H7.78909C4.84483 20.972 3.01367 18.8937 3.01367 15.9534V8.01866C3.01367 5.07733 4.85359 3 7.78909 3Z" stroke="currentColor"></path>
<path d="M15.0273 3.00977V20.9993M8.99414 3.00977V20.9993" stroke="currentColor"></path>
    </svg>
  ),
)

GridInterface9.displayName = 'GridInterface9'

export default GridInterface9
