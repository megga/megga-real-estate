// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Ruble = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.92254 18V6H13.2166C15.018 6 16.4775 7.46031 16.4775 9.26163C16.4775 11.0622 15.018 12.5233 13.2166 12.5241H7.52246" stroke="currentColor"></path>
<path d="M7.52539 15.4512H11.2868" stroke="currentColor"></path>
    </svg>
  ),
)

Ruble.displayName = 'Ruble'

export default Ruble
