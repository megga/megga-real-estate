// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Document3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.5957 15.6964H8.37573" stroke="currentColor"></path>
<path d="M15.5957 11.9366H8.37573" stroke="currentColor"></path>
<path d="M11.131 8.17737H8.37598" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3.60999 12.0001C3.60999 18.9371 5.70798 21.2501 12.001 21.2501C18.295 21.2501 20.392 18.9371 20.392 12.0001C20.392 5.06312 18.295 2.75012 12.001 2.75012C5.70798 2.75012 3.60999 5.06312 3.60999 12.0001Z" stroke="currentColor"></path>
    </svg>
  ),
)

Document3.displayName = 'Document3'

export default Document3
