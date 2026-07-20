// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PyramidChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.19809 17.1968L18.7925 17.1968" stroke="currentColor"></path>
<path d="M19.8706 13.7324L4.14648 13.7324" stroke="currentColor"></path>
<path d="M20.8438 10.2686L3.17383 10.2686" stroke="currentColor"></path>
<path d="M17.2673 6.80444L6.80225 6.80444" stroke="currentColor"></path>
<path d="M10.7898 3.73353C11.5114 3.20923 12.4886 3.20923 13.2102 3.73353L20.1511 8.77639C20.8728 9.30069 21.1747 10.23 20.8991 11.0784L18.2479 19.2379C17.9723 20.0862 17.1817 20.6606 16.2897 20.6606H7.71028C6.81829 20.6606 6.02774 20.0862 5.7521 19.2379L3.10091 11.0784C2.82527 10.23 3.12723 9.30069 3.84887 8.77639L10.7898 3.73353Z" stroke="currentColor"></path>
    </svg>
  ),
)

PyramidChart.displayName = 'PyramidChart'

export default PyramidChart
