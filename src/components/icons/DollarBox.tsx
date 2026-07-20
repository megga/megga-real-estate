// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M16.3103 9.17578H13.6852C12.9039 9.17578 12.2715 9.80919 12.2715 10.5895C12.2715 11.3698 12.9039 12.0032 13.6852 12.0032H15.3003C16.0816 12.0032 16.7141 12.6366 16.7141 13.417C16.7141 14.1983 16.0816 14.8307 15.3003 14.8307H12.6753" stroke="currentColor"></path>
<path d="M14.4922 14.8303V16.0173M14.4922 7.98242V9.18015" stroke="currentColor"></path>
<path d="M7.88672 3V21" stroke="currentColor"></path>
    </svg>
  ),
)

DollarBox.displayName = 'DollarBox'

export default DollarBox
