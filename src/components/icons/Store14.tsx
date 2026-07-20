// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store14 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.95142 7.19371V4.47035C3.95142 4.05099 4.29099 3.71143 4.71034 3.71143H19.3274C19.7525 3.71143 20.095 4.06072 20.0863 4.48689L20.0298 7.12073L20.9843 11.79C21.0807 12.26 20.7207 12.7007 20.241 12.7007H3.75974C3.27909 12.7007 2.92006 12.261 3.01542 11.79L3.95142 7.19371Z" stroke="currentColor"></path>
<path d="M3.95117 7.1936L20.0293 7.1937" stroke="currentColor"></path>
<path d="M19.9775 20.2882V12.7009" stroke="currentColor"></path>
<path d="M4.0415 12.7009V19.2491C4.0415 19.8231 4.50659 20.2882 5.07967 20.2882H13.0843C13.6584 20.2882 14.1225 19.8231 14.1225 19.2491V12.7009" stroke="currentColor"></path>
<path d="M6.35107 12.7009V16.37H10.7917V12.7009" stroke="currentColor"></path>
    </svg>
  ),
)

Store14.displayName = 'Store14'

export default Store14
