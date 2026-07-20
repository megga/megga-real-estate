// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.0903 16.9095L20.9999 16.9096L20.999 12.0009" stroke="currentColor"></path>
<path d="M21 16.9086L13.2269 9.13649L9.13654 13.2269L3 7.09033" stroke="currentColor"></path>
    </svg>
  ),
)

TrendDown.displayName = 'TrendDown'

export default TrendDown
