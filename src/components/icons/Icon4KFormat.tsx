// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Icon4KFormat = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M10.0525 14.6862V13.4632M10.0525 13.4632H11.0887M10.0525 13.4632H7.07031L10.0525 9.31641V13.4632Z" stroke="currentColor"></path>
<path d="M13.5293 9.48438V14.5117" stroke="currentColor"></path>
<path d="M16.9282 9.66797L14.1465 12.0002L16.9282 14.3334" stroke="currentColor"></path>
    </svg>
  ),
)

Icon4KFormat.displayName = 'Icon4KFormat'

export default Icon4KFormat
