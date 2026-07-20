// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Voice24 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.60376 13.8324C6.60376 16.8068 9.01486 19.2179 11.9903 19.2179C14.9647 19.2179 17.3758 16.8068 17.3758 13.8324" stroke="currentColor"></path>
<path d="M17.3757 10.7397V8.59844C17.3757 5.62399 14.9646 3.21289 11.9901 3.21289C9.01474 3.21289 6.60364 5.62399 6.60364 8.59844V10.7397" stroke="currentColor"></path>
<path d="M11.9903 21.2627V19.2183" stroke="currentColor"></path>
<path d="M5.21216 13.8324H18.7677" stroke="currentColor"></path>
<path d="M10.4974 10.4517H13.4823" stroke="currentColor"></path>
<path d="M12.4911 7.68203H11.4879" stroke="currentColor"></path>
    </svg>
  ),
)

Voice24.displayName = 'Voice24'

export default Voice24
