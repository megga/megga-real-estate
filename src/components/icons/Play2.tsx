// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Play2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.25 3.354C17.3578 3.354 21.5 7.49523 21.5 12.604C21.5 17.7128 17.3578 21.854 12.25 21.854C7.14122 21.854 3 17.7128 3 12.604C3 7.49523 7.14122 3.354 12.25 3.354Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.1713 12.5993L10.6641 9.73718V15.4614L15.1713 12.5993Z" stroke="currentColor"></path>
    </svg>
  ),
)

Play2.displayName = 'Play2'

export default Play2
