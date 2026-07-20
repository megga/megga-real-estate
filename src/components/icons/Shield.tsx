// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Shield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6284C19.3237 19.7416 12.0001 21.959 12.0001 21.959C12.0001 21.959 4.67654 19.7426 4.67654 13.6284C4.67654 7.51422 4.40994 7.03649 4.99762 6.44882C5.58627 5.86017 11.0398 3.95898 12.0001 3.95898C12.9604 3.95898 18.413 5.8553 19.0016 6.44882C19.5893 7.04136 19.3237 7.5152 19.3237 13.6284Z" stroke="currentColor"></path>
<path d="M4.6748 11.5613H19.3249M11.9998 21.959V3.95898V21.959Z" stroke="currentColor"></path>
    </svg>
  ),
)

Shield.displayName = 'Shield'

export default Shield
