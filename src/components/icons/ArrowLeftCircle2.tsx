// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeftCircle2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M3 21.25L3 2.75L21.5 2.75L21.5 21.25L3 21.25Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M8.9117 12L16.3359 12" stroke="currentColor" strokeLinecap="square"></path>
<path d="M11.9277 8.25205L8.16373 12L11.9277 15.748" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

ArrowLeftCircle2.displayName = 'ArrowLeftCircle2'

export default ArrowLeftCircle2
