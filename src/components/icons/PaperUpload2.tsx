// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperUpload2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.8181 2.75L4.57535 2.75V21.25H19.9247V8.06826L14.8181 2.75Z" stroke="currentColor"></path>
<path d="M14.3427 3.30469V8.65011H19.4497" stroke="currentColor"></path>
<path d="M11.1145 10.8054V16.8948" stroke="currentColor"></path>
<path d="M13.4785 12.6118L11.1147 10.2379L8.75089 12.6118" stroke="currentColor"></path>
    </svg>
  ),
)

PaperUpload2.displayName = 'PaperUpload2'

export default PaperUpload2
