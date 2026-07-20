// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchGraphUp = forwardRef<SVGSVGElement, Props>(
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
<path d="M12.5957 9.48223L14.7723 8.89551L15.3591 11.0721" stroke="currentColor"></path>
<path d="M14.772 8.89551L12.2548 13.2711L9.95173 11.9469L8.5 14.4699" stroke="currentColor"></path>
<path d="M17.3613 17.583L20.7863 20.9992" stroke="currentColor"></path>
    </svg>
  ),
)

SearchGraphUp.displayName = 'SearchGraphUp'

export default SearchGraphUp
