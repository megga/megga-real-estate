// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Send3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.4933 12.4382C11.4933 12.4382 -0.483351 9.96062 3.6786 7.55807C7.19075 5.53077 19.2947 2.04522 20.9857 2.94582C21.8863 4.63682 18.4007 16.7408 16.3734 20.2529C13.9709 24.4149 11.4933 12.4382 11.4933 12.4382Z" stroke="currentColor"></path>
<path d="M11.4934 12.4382L20.9858 2.9458" stroke="currentColor"></path>
    </svg>
  ),
)

Send3.displayName = 'Send3'

export default Send3
