// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Ticket2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.9605 4.83191V7.07041" stroke="currentColor"></path>
<path d="M13.9605 17.328V19.2002" stroke="currentColor"></path>
<path d="M13.9605 14.1502V9.6908" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 19.4V13.9893C20.3848 13.9893 19.4866 13.1023 19.4866 12.0009C19.4866 10.8996 20.3848 10.0116 21.5 10.0116V4.59998H3V10.0897C4.11525 10.0897 5.01343 10.8996 5.01343 12.0009C5.01343 13.1023 4.11525 13.9893 3 13.9893V19.4H21.5Z" stroke="currentColor"></path>
    </svg>
  ),
)

Ticket2.displayName = 'Ticket2'

export default Ticket2
