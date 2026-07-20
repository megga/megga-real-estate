// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Chart" stroke="none" fill="none" fillRule="evenodd"> <g id="Chart" transform="translate(2.000000, 2.000000)" stroke="currentColor"> <line x1="5.37142857" y1="8.20171265" x2="5.37142857" y2="15.0618459" id="Line_182"></line> <line x1="10.0380952" y1="4.91912464" x2="10.0380952" y2="15.0618459" id="Line_183"></line> <line x1="14.6285714" y1="11.8268316" x2="14.6285714" y2="15.0618459" id="Line_184"></line> <path d="M14.6857143,0 L5.31428571,0 C2.04761905,0 0,2.31208373 0,5.58515699 L0,14.414843 C0,17.6879163 2.03809524,20 5.31428571,20 L14.6857143,20 C17.9619048,20 20,17.6879163 20,14.414843 L20,5.58515699 C20,2.31208373 17.9619048,0 14.6857143,0 Z" id="Path"></path> </g> </g>
    </svg>
  ),
)

Chart.displayName = 'Chart'

export default Chart
