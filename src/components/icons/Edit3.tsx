// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Edit3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.3352 19.5078H19.7122" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.0578 4.85889V4.85889C14.7138 3.85089 12.8078 4.12289 11.7998 5.46589C11.7998 5.46589 6.78679 12.1439 5.04779 14.4609C3.30879 16.7789 4.95379 19.6509 4.95379 19.6509C4.95379 19.6509 8.19779 20.3969 9.91179 18.1119C11.6268 15.8279 16.6638 9.11689 16.6638 9.11689C17.6718 7.77389 17.4008 5.86689 16.0578 4.85889Z" stroke="currentColor"></path>
<path d="M10.5042 7.21143L15.3682 10.8624" stroke="currentColor"></path>
    </svg>
  ),
)

Edit3.displayName = 'Edit3'

export default Edit3
