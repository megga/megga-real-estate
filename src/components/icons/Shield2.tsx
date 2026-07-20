// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Shield2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12 21.959C12 21.959 19.3236 19.7416 19.3236 13.6284C19.3236 7.5152 19.5892 7.04136 19.0015 6.44882C18.4129 5.8553 12.9603 3.95898 12 3.95898C11.0397 3.95898 5.58625 5.86017 4.99755 6.44882C4.40995 7.03649 4.67655 7.51422 4.67655 13.6284C4.67655 19.7426 12 21.959 12 21.959Z" stroke="currentColor"></path>
<path d="M11.999 21.959V3.95898" stroke="currentColor"></path>
    </svg>
  ),
)

Shield2.displayName = 'Shield2'

export default Shield2
