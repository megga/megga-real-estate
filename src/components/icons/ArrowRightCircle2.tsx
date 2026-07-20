// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.25 21.25C17.358 21.25 21.5 17.109 21.5 12C21.5 6.892 17.358 2.75 12.25 2.75C7.142 2.75 3 6.892 3 12C3 17.109 7.142 21.25 12.25 21.25Z" stroke="currentColor"></path>
<path d="M10.8076 15.4712L14.2936 12.0002L10.8076 8.52919" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowRightCircle2.displayName = 'ArrowRightCircle2'

export default ArrowRightCircle2
