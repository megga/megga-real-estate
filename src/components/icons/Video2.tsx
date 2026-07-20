// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Video2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M2.7998 5.125V18.875H17.2848V5.125H2.7998Z" stroke="currentColor"></path>
<path d="M17.8049 9.45161L22.8002 5.99463V18.0046L17.8062 14.5479" stroke="currentColor"></path>
<path d="M9.95801 9.08643H13.163" stroke="currentColor"></path>
    </svg>
  ),
)

Video2.displayName = 'Video2'

export default Video2
