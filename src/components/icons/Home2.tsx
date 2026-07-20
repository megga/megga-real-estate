// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Home2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M2.18384 11.3755L12.25 2.75L22.3162 11.3755" stroke="currentColor"></path>
<path d="M4.34302 10.1592V21.2501H20.1606V10.1592" stroke="currentColor"></path>
<path d="M12.25 12.7048L12.25 16.1132" stroke="currentColor"></path>
    </svg>
  ),
)

Home2.displayName = 'Home2'

export default Home2
