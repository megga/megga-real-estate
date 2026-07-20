// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchGraphDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.0494 11.4185C20.0494 6.77042 16.2809 3.00098 11.6319 3.00098C6.98283 3.00098 3.21436 6.77042 3.21436 11.4185C3.21436 16.0685 6.98283 19.837 11.6319 19.837C16.2809 19.837 20.0494 16.0685 20.0494 11.4185Z" stroke="currentColor"></path>
<path d="M12.5957 13.8838L14.7723 14.4715L15.3591 12.2939" stroke="currentColor"></path>
<path d="M14.774 14.4699L12.2568 10.0933L9.95369 11.4185L8.50195 8.89551" stroke="currentColor"></path>
<path d="M17.3613 17.583L20.7863 20.9992" stroke="currentColor"></path>
    </svg>
  ),
)

SearchGraphDown.displayName = 'SearchGraphDown'

export default SearchGraphDown
