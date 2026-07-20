// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Password2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M10.9394 12.0004C10.9394 13.0234 10.1104 13.8524 9.08735 13.8524C8.06435 13.8524 7.23535 13.0234 7.23535 12.0004C7.23535 10.9774 8.06435 10.1484 9.08735 10.1484H9.09035C10.1114 10.1494 10.9394 10.9784 10.9394 12.0004Z" stroke="currentColor" strokeLinecap="square"></path>
<path d="M10.9419 12H17.2599V13.852" stroke="currentColor" strokeLinecap="square"></path>
<path d="M14.4316 13.852V12" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.25L21.5 2.75L3 2.75L3 21.25L21.5 21.25Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Password2.displayName = 'Password2'

export default Password2
