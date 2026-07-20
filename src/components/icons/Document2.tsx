// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Document2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.0416 9.229H8.97162" stroke="currentColor"></path>
<path d="M11.2876 13.3931H8.97162" stroke="currentColor"></path>
<path d="M4.22699 2.75V21.25H20.973V2.75H4.22699Z" stroke="currentColor"></path>
    </svg>
  ),
)

Document2.displayName = 'Document2'

export default Document2
