// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperUpload22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M14.8181 2.88867L4.57535 2.88867V21.3887H19.9247V8.20693L14.8181 2.88867Z" stroke="currentColor"></path>
<path d="M14.3429 3.44336V8.78878H19.45" stroke="currentColor"></path>
<path d="M11.1144 10.6196L11.1144 18.466" stroke="currentColor"></path>
<path d="M8.52761 13.2065C9.85744 13.2065 11.1144 12.0354 11.1144 10.6197" stroke="currentColor"></path>
<path d="M13.7012 13.2065C12.3714 13.2065 11.1144 12.0354 11.1144 10.6197" stroke="currentColor"></path>
    </svg>
  ),
)

PaperUpload22.displayName = 'PaperUpload22'

export default PaperUpload22
