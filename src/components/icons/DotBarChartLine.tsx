// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DotBarChartLine = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.2633 7.56532L15.583 10.7642M5.70585 10.9465L8.49707 7.58907M13.3918 10.7676L10.6881 7.58527M6.22805 12.1294C6.22805 13.0205 5.50519 13.7434 4.61402 13.7434C3.72286 13.7434 3 13.0205 3 12.1294C3 11.2372 3.72286 10.5153 4.61402 10.5153C5.50519 10.5153 6.22805 11.2372 6.22805 12.1294ZM12.8752 11.945C12.8752 11.0529 13.5981 10.331 14.4892 10.331C15.3804 10.331 16.1033 11.0529 16.1033 11.945C16.1033 12.8372 15.3804 13.5591 14.4892 13.5591C13.601 13.563 12.8791 12.8459 12.8752 11.9577V11.945ZM11.2046 6.40699C11.2046 7.29913 10.4817 8.02101 9.59058 8.02101C8.69844 8.02101 7.97656 7.29913 7.97656 6.40699C7.97656 5.51583 8.69844 4.79297 9.59058 4.79297C10.4817 4.79297 11.2046 5.51583 11.2046 6.40699ZM21 6.40699C21 7.29913 20.2771 8.02101 19.386 8.02101C18.4938 8.02101 17.772 7.29913 17.772 6.40699C17.772 5.51583 18.4938 4.79297 19.386 4.79297C20.2771 4.79297 21 5.51583 21 6.40699Z" stroke="currentColor"></path>
<path d="M14.4885 17.16V19.2089M19.3853 13.4224V19.2091M9.58989 13.4224V19.2091M4.61523 17.3443V19.2094" stroke="currentColor"></path>
    </svg>
  ),
)

DotBarChartLine.displayName = 'DotBarChartLine'

export default DotBarChartLine
