// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Star9 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.25 2.31055L14.1969 6.86031L18.7907 5.01981L16.9502 9.61364L21.5 11.5605L16.9502 13.5074L18.7907 18.1013L14.1969 16.2608L12.25 20.8105L10.3031 16.2608L5.70926 18.1013L7.54976 13.5074L3 11.5605L7.54976 9.61364L5.70926 5.01981L10.3031 6.86031L12.25 2.31055Z" stroke="currentColor"></path>
    </svg>
  ),
)

Star9.displayName = 'Star9'

export default Star9
