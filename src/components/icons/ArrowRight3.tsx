// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRight3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.75 11.7257L4.75 11.7257" stroke="currentColor"></path>
<path d="M13.6997 5.70124C13.6997 5.70124 19.7497 8.96224 19.7497 11.7242C19.7497 14.4882 13.6997 17.7502 13.6997 17.7502" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowRight3.displayName = 'ArrowRight3'

export default ArrowRight3
