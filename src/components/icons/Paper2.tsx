// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Paper2 = forwardRef<SVGSVGElement, Props>(
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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M14.3429 16.2865H8.89966" stroke="currentColor"></path>
<path d="M12.2816 12.504H8.89868" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.8182 2.75L4.57544 2.75V21.25H19.9247V8.06826L14.8182 2.75Z" stroke="currentColor"></path>
<path d="M14.342 3.30469V8.65011H19.4491" stroke="currentColor"></path>
    </svg>
  ),
)

Paper2.displayName = 'Paper2'

export default Paper2
