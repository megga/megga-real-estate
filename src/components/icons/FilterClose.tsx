// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterClose = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.0957 3.85742C19.5785 3.85742 20.7801 5.05906 20.7801 6.54188V7.906C20.7801 8.97434 20.3277 9.99208 19.5337 10.7072L14.6095 15.578C14.2855 15.8689 14.1006 16.2844 14.1006 16.7203V18.71C14.1006 19.3395 13.7163 19.9068 13.1305 20.1393L11.2488 20.8885C10.2378 21.2913 9.14033 20.547 9.14033 19.4592V16.2347C9.14033 15.8261 8.97784 15.4349 8.68983 15.146L4.32309 11.2589C3.61573 10.5515 3.21875 9.59218 3.21875 8.59196V6.54188C3.21875 5.05906 4.42038 3.85742 5.90321 3.85742" stroke="currentColor"></path>
<path d="M14.1987 3L9.79883 7.39983M14.1987 7.39983L9.79883 3" stroke="currentColor"></path>
    </svg>
  ),
)

FilterClose.displayName = 'FilterClose'

export default FilterClose
