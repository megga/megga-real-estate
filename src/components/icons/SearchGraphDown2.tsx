// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchGraphDown2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.4736 8.88482C18.7479 9.69046 18.8968 10.5535 18.8968 11.4516C18.8968 15.8408 15.3386 19.4 10.9484 19.4C6.55825 19.4 3 15.8408 3 11.4516C3 7.06142 6.55825 3.50317 10.9484 3.50317C12.4293 3.50317 13.8158 3.90794 15.0029 4.61336" stroke="currentColor"></path>
<path d="M16.3574 17.2744L19.5917 20.4999" stroke="currentColor"></path>
<path d="M20.9995 6.3252L15.1255 11.7818L12.5869 9.02331L8.32812 13.0408" stroke="currentColor"></path>
<path d="M11.204 13.2021L8.25975 13.207L8.25586 10.2627" stroke="currentColor"></path>
    </svg>
  ),
)

SearchGraphDown2.displayName = 'SearchGraphDown2'

export default SearchGraphDown2
