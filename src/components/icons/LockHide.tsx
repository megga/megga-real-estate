// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LockHide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.8418 6.79994C9.3718 5.16994 10.8878 3.99495 12.6878 3.96695C14.9518 3.94795 16.8188 5.75694 16.8478 8.02194V10.6369" stroke="currentColor"></path>
<path d="M8.29599 10.9512C7.08399 12.1172 6.33398 13.7552 6.33398 15.5652C6.33398 19.1072 9.20598 21.9692 12.739 21.9692C14.548 21.9692 16.188 21.2212 17.352 20.0072" stroke="currentColor"></path>
<path d="M18.8636 21.5199L4.84961 7.50586" stroke="currentColor"></path>
<path d="M19.0702 16.5725C19.1232 16.2415 19.1501 15.9025 19.1501 15.5565C19.1501 12.0165 16.2801 9.14648 12.7401 9.14648C12.0891 9.14648 11.4611 9.24348 10.8691 9.42448" stroke="currentColor"></path>
    </svg>
  ),
)

LockHide.displayName = 'LockHide'

export default LockHide
