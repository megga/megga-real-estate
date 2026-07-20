// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Eye2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 12.9672C3 16.5892 7.289 20.0692 12 20.0692C16.712 20.0692 21 16.5892 21 12.9672C21 9.34524 16.674 5.86523 12 5.86523C7.327 5.86523 3 9.34524 3 12.9672Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.0788 12.9657C15.0788 11.2667 13.7008 9.88867 12.0018 9.88867C10.3038 9.88867 8.92578 11.2667 8.92578 12.9657C8.92578 14.6637 10.3038 16.0417 12.0018 16.0417C13.7008 16.0417 15.0788 14.6637 15.0788 12.9657Z" stroke="currentColor"></path>
    </svg>
  ),
)

Eye2.displayName = 'Eye2'

export default Eye2
