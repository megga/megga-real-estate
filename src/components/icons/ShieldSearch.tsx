// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6089C19.3237 19.7221 11.9997 21.9395 11.9997 21.9395C11.9997 21.9395 4.67668 19.7231 4.67668 13.6089C4.67668 7.49466 4.4097 7.01695 4.9977 6.42925C5.5867 5.84065 11.0397 3.93945 11.9997 3.93945C12.9607 3.93945 18.4127 5.83575 19.0007 6.42925C19.5897 7.02185 19.3237 7.49566 19.3237 13.6089Z" stroke="currentColor"></path>
<path d="M13.3489 13.9998L14.8129 15.4602L13.3489 13.9998ZM11.3708 8.96289C12.9768 8.96289 14.2789 10.2647 14.2789 11.8701C14.2789 13.4756 12.9768 14.7764 11.3708 14.7764C9.76585 14.7764 8.46387 13.4756 8.46387 11.8701C8.46387 10.2647 9.76585 8.96289 11.3708 8.96289Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldSearch.displayName = 'ShieldSearch'

export default ShieldSearch
