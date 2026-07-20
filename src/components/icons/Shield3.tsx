// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Shield3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9997 21.959C11.9997 21.959 19.3237 19.7416 19.3237 13.6284C19.3237 7.5152 19.5897 7.04136 19.0017 6.44882C18.4127 5.8553 12.9607 3.95898 11.9997 3.95898C11.0397 3.95898 5.58669 5.86017 4.99769 6.44882C4.40969 7.03649 4.67669 7.51422 4.67669 13.6284C4.67669 19.7426 11.9997 21.959 11.9997 21.959Z" stroke="currentColor"></path>
    </svg>
  ),
)

Shield3.displayName = 'Shield3'

export default Shield3
