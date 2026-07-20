// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BoltCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.364 5.6361C21.8787 9.15082 21.8787 14.8493 18.364 18.364C14.8492 21.8787 9.15076 21.8787 5.63604 18.364C2.12132 14.8493 2.12132 9.15082 5.63604 5.6361C9.15076 2.12138 14.8492 2.12138 18.364 5.6361Z" stroke="currentColor"></path>
<path d="M11.9836 16L14.5706 12.0011H9.42773L12.012 8" stroke="currentColor"></path>
    </svg>
  ),
)

BoltCircle.displayName = 'BoltCircle'

export default BoltCircle
