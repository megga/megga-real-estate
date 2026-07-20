// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bolt2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.99575 20.0998H19.004C20.5329 20.0998 21.4926 18.4484 20.7359 17.1196L13.776 4.90455C13.0135 3.56696 11.0872 3.56211 10.3179 4.8958L3.26962 17.1108C2.50321 18.4397 3.46195 20.0998 4.99575 20.0998Z" stroke="currentColor"></path>
<path d="M11.9864 17.1484L14.25 13.6494H9.75L12.0112 10.1484" stroke="currentColor"></path>
    </svg>
  ),
)

Bolt2.displayName = 'Bolt2'

export default Bolt2
