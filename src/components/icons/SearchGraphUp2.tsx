// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchGraphUp2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.4677 8.88589C18.7421 9.69051 18.891 10.5535 18.891 11.4515C18.891 15.8395 15.3339 19.3975 10.946 19.3975C6.55705 19.3975 3 15.8395 3 11.4515C3 7.06358 6.55705 3.50653 10.946 3.50653C12.4258 3.50653 13.8122 3.91127 14.9992 4.61665" stroke="currentColor"></path>
<path d="M20.8961 6.3252L15.0245 11.7795L12.4861 9.02217L8.23047 13.0385" stroke="currentColor"></path>
<path d="M18.0527 6.17284L20.9959 6.16895L21.0007 9.1111" stroke="currentColor"></path>
<path d="M16.3535 17.2705L19.5866 20.4948" stroke="currentColor"></path>
    </svg>
  ),
)

SearchGraphUp2.displayName = 'SearchGraphUp2'

export default SearchGraphUp2
