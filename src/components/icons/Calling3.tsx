// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Calling3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.3525 2.75012C18.0535 3.16112 20.9775 6.08112 21.3935 9.78212" stroke="currentColor"></path>
<path d="M14.3525 6.29309C16.1235 6.63709 17.5075 8.02209 17.8525 9.79309" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.70049 16.299C0.802504 9.40022 1.78338 6.24115 2.51055 5.22316C2.60396 5.05862 4.90647 1.61188 7.37459 3.63407C13.5008 8.67945 5.7451 7.96611 10.8894 13.1113C16.0348 18.2554 15.3203 10.5 20.3659 16.6249C22.3882 19.094 18.9413 21.3964 18.7778 21.4888C17.7598 22.217 14.5995 23.1978 7.70049 16.299Z" stroke="currentColor"></path>
    </svg>
  ),
)

Calling3.displayName = 'Calling3'

export default Calling3
