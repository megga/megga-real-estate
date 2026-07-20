// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDown34 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.8938 12.7001V3.75012" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.8998 20.3539C13.1558 20.3539 17.1708 13.9899 16.4488 13.2679C15.7268 12.5459 8.14181 12.4769 7.35081 13.2679C6.55981 14.0599 10.6448 20.3539 11.8998 20.3539Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDown34.displayName = 'ArrowDown34'

export default ArrowDown34
