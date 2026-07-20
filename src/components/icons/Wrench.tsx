// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Wrench = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.03237 21V17.1996C6.25842 16.0349 4.30664 13.3077 4.30664 10.0998C4.30664 6.90357 6.25842 4.16465 9.03237 3V9.07038C9.03237 9.47319 9.27367 9.83611 9.64534 9.99178L11.6127 10.8169C11.8608 10.921 12.1391 10.92 12.3872 10.8159L14.3448 9.99276C14.7155 9.83611 14.9568 9.47319 14.9568 9.07135V3C17.7415 4.15297 19.6932 6.90357 19.6932 10.0998C19.6932 13.3077 17.7415 16.0466 14.9568 17.1996V21" stroke="currentColor"></path>
    </svg>
  ),
)

Wrench.displayName = 'Wrench'

export default Wrench
