// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DotBarLineChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.68848 19.9979V13.4249M12.0002 19.9979V10.6079M19.3118 19.9979V16.2419" stroke="currentColor"></path>
<path d="M10.3748 6.15869L6.26709 7.75009" stroke="currentColor"></path>
<path d="M13.4224 6.57617L17.9138 10.0181" stroke="currentColor"></path>
<path d="M10.8065 4.49693C10.1472 5.15625 10.1472 6.22521 10.8065 6.88453C11.4658 7.54385 12.5348 7.54385 13.1941 6.88453C13.8534 6.22521 13.8534 5.15625 13.1941 4.49693C12.5348 3.83761 11.4658 3.83761 10.8065 4.49693Z" stroke="currentColor"></path>
<path d="M18.118 9.79332C17.4587 10.4526 17.4587 11.5216 18.118 12.1809C18.7773 12.8402 19.8463 12.8402 20.5056 12.1809C21.1649 11.5216 21.1649 10.4526 20.5056 9.79332C19.8463 9.134 18.7773 9.134 18.118 9.79332Z" stroke="currentColor"></path>
<path d="M3.49449 7.12974C2.83517 7.78906 2.83517 8.85802 3.49449 9.51734C4.1538 10.1767 5.22277 10.1767 5.88209 9.51734C6.5414 8.85802 6.5414 7.78906 5.88209 7.12974C5.22277 6.47042 4.1538 6.47042 3.49449 7.12974Z" stroke="currentColor"></path>
    </svg>
  ),
)

DotBarLineChart2.displayName = 'DotBarLineChart2'

export default DotBarLineChart2
