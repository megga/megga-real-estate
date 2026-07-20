// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TreadingHouseUp2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M8.16504 15.6182L10.6235 12.4238L13.4278 14.6257L15.8336 11.5205" stroke="currentColor"></path>
<path d="M19.5039 8.77441V17.4494C19.5039 19.1414 18.132 20.5133 16.44 20.5133H7.56066C5.86866 20.5133 4.49677 19.1414 4.49677 17.4494V8.77441" stroke="currentColor"></path>
<path d="M3 9.95513L10.5259 3.99762C11.3899 3.31459 12.6101 3.31459 13.4741 3.99762L21 9.95513" stroke="currentColor"></path>
    </svg>
  ),
)

TreadingHouseUp2.displayName = 'TreadingHouseUp2'

export default TreadingHouseUp2
