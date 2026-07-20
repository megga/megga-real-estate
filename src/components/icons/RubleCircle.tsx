// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RubleCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M10.8053 16.2507V8.49512H13.5802C14.7448 8.49512 15.6886 9.4389 15.6886 10.6026C15.6886 11.7672 14.7448 12.711 13.5802 12.711H9.90039" stroke="currentColor"></path>
<path d="M9.90039 14.6025H12.3319" stroke="currentColor"></path>
    </svg>
  ),
)

RubleCircle.displayName = 'RubleCircle'

export default RubleCircle
