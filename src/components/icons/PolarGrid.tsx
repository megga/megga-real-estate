// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PolarGrid = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12.0005C21 7.03054 16.9709 3.00049 12 3.00049C7.02908 3.00049 3 7.03054 3 12.0005C3 16.9714 7.02908 21.0005 12 21.0005C16.9709 21.0005 21 16.9714 21 12.0005Z" stroke="currentColor"></path>
<path d="M17.145 12.0002C17.145 14.8415 14.8416 17.1455 11.9998 17.1455C9.1579 17.1455 6.85449 14.8415 6.85449 12.0002C6.85449 9.15839 9.1579 6.85498 11.9998 6.85498C14.8416 6.85498 17.145 9.15839 17.145 12.0002Z" stroke="currentColor"></path>
<path d="M12 12.0005V21.0005" stroke="currentColor"></path>
<path d="M12.0039 12.0005L20.5942 14.665" stroke="currentColor"></path>
<path d="M12 11.9966L17.7163 5.05786" stroke="currentColor"></path>
<path d="M12 11.9927L3.40186 14.665" stroke="currentColor"></path>
<path d="M12.0039 12.0044L6.27979 5.05786" stroke="currentColor"></path>
    </svg>
  ),
)

PolarGrid.displayName = 'PolarGrid'

export default PolarGrid
