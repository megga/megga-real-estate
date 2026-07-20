// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartBoard = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 16.4174V16.9243C3 18.2651 4.08778 19.3529 5.42854 19.3529H18.5715C19.9122 19.3529 21 18.2651 21 16.9243V16.4174C21 16.1138 20.7538 15.8677 20.4493 15.8677H3.54973C3.24616 15.8677 3 16.1138 3 16.4174Z" stroke="currentColor"></path>
<path d="M19.669 15.8678V7.66174C19.669 5.99795 18.3205 4.64941 16.6576 4.64941H7.34143C5.67764 4.64941 4.3291 5.99795 4.3291 7.66174V15.8678" stroke="currentColor"></path>
<path d="M8.36914 8.21191V12.3928M15.6294 9.07087V12.3936M12.1945 10.4296V12.394" stroke="currentColor"></path>
    </svg>
  ),
)

ChartBoard.displayName = 'ChartBoard'

export default ChartBoard
