// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TVStand = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.9709 16.718C19.1961 16.718 21 14.9141 21 12.6889V7.23245C21 5.00726 19.1961 3.20337 16.9709 3.20337H7.02811C4.80389 3.20337 3 5.00726 3 7.23245V12.6889C3 14.9141 4.80389 16.718 7.02811 16.718" stroke="currentColor"></path>
<path d="M8.96094 20.6325L11.583 16.6657C11.7807 16.3666 12.2197 16.3667 12.4173 16.6658L15.0395 20.636" stroke="currentColor"></path>
<path d="M7.34961 7.98828H10.837" stroke="currentColor"></path>
<path d="M9.09375 7.98828L9.09375 11.9315" stroke="currentColor"></path>
<path d="M12.9893 7.98828L14.8198 11.9315L16.6504 7.98828" stroke="currentColor"></path>
    </svg>
  ),
)

TVStand.displayName = 'TVStand'

export default TVStand
