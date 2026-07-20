// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lira = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.0923 6V13.2436C10.0923 15.8707 12.2216 18 14.8486 18H17.0968" stroke="currentColor"></path>
<path d="M6.90234 12.3798H13.5944" stroke="currentColor"></path>
<path d="M6.90234 9.18945H13.5944" stroke="currentColor"></path>
    </svg>
  ),
)

Lira.displayName = 'Lira'

export default Lira
