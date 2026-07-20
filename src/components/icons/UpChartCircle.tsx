// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UpChartCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.625 14.3385L10.4303 10.6934L13.6303 13.2059L16.3756 9.6626" stroke="currentColor"></path>
<path d="M21 12.0005C21 7.03054 16.9709 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005Z" stroke="currentColor"></path>
    </svg>
  ),
)

UpChartCircle.displayName = 'UpChartCircle'

export default UpChartCircle
