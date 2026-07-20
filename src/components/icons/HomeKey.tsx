// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HomeKey = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.2159 21.4526H6.78462C4.94959 21.4526 3.46289 19.965 3.46289 18.1309V10.9572C3.46289 10.0659 3.86376 9.22237 4.55457 8.65902L10.1287 4.11815C11.2185 3.2308 12.782 3.2308 13.8718 4.11815L19.4459 8.65902C20.1367 9.22237 20.5376 10.0659 20.5376 10.9572V18.1309C20.5376 19.965 19.0509 21.4526 17.2159 21.4526Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.0602 13.5457C13.0602 14.5417 13.8668 15.3477 14.8621 15.3477C15.8575 15.3477 16.6641 14.5417 16.6641 13.5457C16.6641 12.5507 15.8575 11.7437 14.8621 11.7437H14.8582C13.8648 11.7457 13.0602 12.5527 13.0602 13.5457Z" stroke="currentColor"></path>
<path d="M13.0117 13.5483H7.33597V15.3503" stroke="currentColor"></path>
<path d="M10.0879 15.3503V13.5483" stroke="currentColor"></path>
    </svg>
  ),
)

HomeKey.displayName = 'HomeKey'

export default HomeKey
