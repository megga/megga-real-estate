// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dollar2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.555 9.20714V9.07867C15.555 7.8549 14.5627 6.86255 13.3381 6.86255H11.122C9.64291 6.86255 8.44385 8.06078 8.44385 9.53984C8.44467 11.0189 9.64373 12.2171 11.122 12.2171H12.9823C14.4037 12.2171 15.5558 13.3693 15.5558 14.7907C15.5558 16.2129 14.4037 17.365 12.9823 17.365H10.6616C9.43785 17.3642 8.44549 16.3718 8.44549 15.1473" stroke="currentColor"></path>
<path d="M11.998 5V19" stroke="currentColor"></path>
    </svg>
  ),
)

Dollar2.displayName = 'Dollar2'

export default Dollar2
