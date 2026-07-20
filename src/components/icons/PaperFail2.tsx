// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperFail2 = forwardRef<SVGSVGElement, Props>(
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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M13.406 15.8324L9.91226 12.3386" stroke="currentColor"></path>
<path d="M9.91422 15.8324L13.408 12.3386" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.8181 2.75L4.57535 2.75V21.25H19.9247V8.06826L14.8181 2.75Z" stroke="currentColor"></path>
<path d="M14.3419 3.30469V8.65011H19.449" stroke="currentColor"></path>
    </svg>
  ),
)

PaperFail2.displayName = 'PaperFail2'

export default PaperFail2
