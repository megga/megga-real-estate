// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitPull3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.59816 9.63382C5.16358 9.63382 4 8.47024 4 7.03566C4 5.60108 5.16358 4.4375 6.59816 4.4375C8.03274 4.4375 9.19632 5.60108 9.19632 7.03566C9.19632 8.47024 8.03274 9.63382 6.59816 9.63382Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.4019 19.5596C15.9673 19.5596 14.8037 18.396 14.8037 16.9614C14.8037 15.5269 15.9673 14.3633 17.4019 14.3633C18.8364 14.3633 20 15.5269 20 16.9614C20 18.396 18.8364 19.5596 17.4019 19.5596Z" stroke="currentColor"></path>
<path d="M6.59785 9.63672L6.59766 19.5621" stroke="currentColor"></path>
<path d="M17.4022 14.2998V9.00419C17.4022 7.93183 16.5328 7.0625 15.4605 7.0625H12.6074" stroke="currentColor"></path>
    </svg>
  ),
)

GitPull3.displayName = 'GitPull3'

export default GitPull3
