// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperDownload22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
<path d="M14.3419 3.44336V8.78878H19.449" stroke="currentColor"></path>
<path d="M11.1134 17.6719L11.1134 9.8255" stroke="currentColor"></path>
<path d="M8.52664 15.085C9.85647 15.085 11.1134 16.2561 11.1134 17.6718" stroke="currentColor"></path>
<path d="M13.7002 15.085C12.3704 15.085 11.1134 16.2561 11.1134 17.6718" stroke="currentColor"></path>
    </svg>
  ),
)

PaperDownload22.displayName = 'PaperDownload22'

export default PaperDownload22
