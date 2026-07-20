// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Download6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0005 16V4M12.0005 16L15 13.0823M12.0005 16L9 13.0823" stroke="currentColor"></path>
<path d="M8.75 10H7.5C5.01472 10 3 12.2386 3 15C3 17.7614 5.01472 20 7.5 20H16.5C18.9853 20 21 17.7614 21 15C21 12.2386 18.9853 10 16.5 10H15.25" stroke="currentColor"></path>
    </svg>
  ),
)

Download6.displayName = 'Download6'

export default Download6
